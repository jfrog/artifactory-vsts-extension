const tl = require('azure-pipelines-task-lib/task');
const utils = require('artifactory-tasks-utils');

const cliGradleCommand = 'rt gradle';
const gradleConfigCommand = 'rt gradlec';
let serverIdDeployer;
let serverIdResolver;

utils.executeCliTask(RunTaskCbk);

function RunTaskCbk(cliPath) {
    let workDir = getWorkDir();
    try {
        if (!workDir) {
            tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
            return;
        }
        executeGradleConfig(cliPath, workDir);
        executeGradle(cliPath, workDir);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return;
    } finally {
        cleanup(cliPath, workDir);
    }

    tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
}

/**
 * Get working directory from input. If missing, return the default working directory.
 * @returns {string}
 */
function getWorkDir() {
    let workDir = tl.getInput('workDir');
    if (!workDir) {
        workDir = tl.getVariable('System.DefaultWorkingDirectory');
    }
    return workDir;
}

/**
 * Run 'jfrog rt gradle-config'.
 * @param cliPath - Path to JFrog CLI
 * @param workDir - Gradle project directory
 */
function executeGradleConfig(cliPath, workDir) {
    // Build the cli config command.
    let cliCommand = utils.cliJoin(cliPath, gradleConfigCommand);

    // Configure resolver server, throws on failure.
    let artifactoryResolver = tl.getInput('artifactoryResolverService');
    if (!!artifactoryResolver) {
        serverIdResolver = utils.assembleBuildToolServerId('gradle', 'resolver');
        utils.configureCliServer(artifactoryResolver, serverIdResolver, cliPath, workDir);
        cliCommand = utils.cliJoin(cliCommand, '--server-id-resolve=' + utils.quote(serverIdResolver));
    } else {
        console.log('Resolution from Artifactory is not configured');
    }

    // Configure deployer server, throws on failure.
    let artifactoryDeployer = tl.getInput('artifactoryDeployerService');
    if (!!artifactoryDeployer) {
        serverIdDeployer = utils.assembleBuildToolServerId('gradle', 'deployer');
        utils.configureCliServer(artifactoryDeployer, serverIdDeployer, cliPath, workDir);
        cliCommand = utils.cliJoin(cliCommand, '--server-id-deploy=' + utils.quote(serverIdDeployer));
    }

    // Add common Gradle config parameters.
    cliCommand = utils.addStringParam(cliCommand, 'sourceRepo', 'repo-resolve');
    cliCommand = utils.addStringParam(cliCommand, 'targetRepo', 'repo-deploy');
    cliCommand = utils.addBoolParam(cliCommand, 'usesPlugin', 'uses-plugin');
    cliCommand = utils.addBoolParam(cliCommand, 'useWrapper', 'use-wrapper');
    cliCommand = utils.addBoolParam(cliCommand, 'deployMavenDesc', 'deploy-maven-desc');
    cliCommand = utils.addBoolParam(cliCommand, 'deployIvyDesc', 'deploy-ivy-desc');
    cliCommand = utils.addStringParam(cliCommand, 'ivyDescPattern', 'ivy-desc-pattern');
    cliCommand = utils.addStringParam(cliCommand, 'ivyArtifactsPattern', 'ivy-artifacts-pattern');

    // Execute cli.
    utils.executeCliCommand(cliCommand, workDir, null);
}

/**
 * Run 'jfrog rt gradle'.
 * @param cliPath - Path to JFrog CLI
 * @param workDir - Gradle project directory
 */
function executeGradle(cliPath, workDir) {
    let tasksAndOptions = tl.getInput('tasks');
    let options = tl.getInput('options');
    if (options) {
        tasksAndOptions = utils.cliJoin(tasksAndOptions, options);
    }
    tasksAndOptions = utils.cliJoin(tasksAndOptions, '-b', tl.getInput('gradleBuildFile'));
    let gradleCommand = utils.cliJoin(cliPath, cliGradleCommand, utils.quote(tasksAndOptions));
    gradleCommand = utils.appendBuildFlagsToCliCommand(gradleCommand);

    // Execute cli.
    utils.executeCliCommand(gradleCommand, workDir, null);
}

/**
 * Removes the cli server config and env variables set in ToolsInstaller task.
 * @throws In CLI execution failure.
 */
function removeExtractorDownloadVariables(cliPath, workDir) {
    let serverId = tl.getVariable('JFROG_CLI_JCENTER_REMOTE_SERVER');
    if (!serverId) {
        return;
    }
    tl.setVariable('JFROG_CLI_JCENTER_REMOTE_SERVER', '');
    tl.setVariable('JFROG_CLI_JCENTER_REMOTE_REPO', '');
    utils.deleteCliServers(cliPath, workDir, [serverId]);
}

function cleanup(cliPath, workDir) {
    // Delete servers.
    try {
        utils.deleteCliServers(cliPath, workDir, [serverIdDeployer, serverIdResolver]);
    } catch (deleteServersException) {
        tl.setResult(tl.TaskResult.Failed, deleteServersException);
    }
    // Remove extractor variables.
    try {
        removeExtractorDownloadVariables(cliPath, workDir);
    } catch (removeVariablesException) {
        tl.setResult(tl.TaskResult.Failed, removeVariablesException);
    }
}
