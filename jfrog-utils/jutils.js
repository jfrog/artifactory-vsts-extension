const fs = require('fs-extra');
const tl = require('vsts-task-lib/task');
const crypto = require('crypto');
const path = require('path');
const request = require('request-promise-lite');
const execSync = require('child_process').execSync;

const fileName = getFileName();
const btPackage = "jfrog-cli-" + getArchitecture();
const jfrogFolderPath = path.join(tl.getVariable("Agent.WorkFolder"), "_jfrog");
const version = "1.17.1";
const versionedCliPath = path.join(jfrogFolderPath, version, fileName);
const customCliPath = path.join(jfrogFolderPath, "current", fileName);
const cliUrl = 'https://api.bintray.com/content/jfrog/jfrog-cli-go/' + version + '/' + btPackage + '/' + fileName + "?bt_package=" + btPackage;
const MAX_CLI_DOWNLOADS_RETRIES = 10;
const DOWNLOAD_CLI_ERR = "Failed while attempting to download JFrog CLI from " + cliUrl +
    ". If this build agent is not accessible to the internet, you can manually place version " + version +
    " of JFrog CLI on the agent in the following path: " + customCliPath;

let runTaskCbk = null;

module.exports = {
    executeCliTask: executeCliTask,
    executeCliCommand: executeCliCommand,
    cliJoin: cliJoin,
    quote: quote,
    addArtifactoryCredentials: addArtifactoryCredentials,
    addStringParam: addStringParam,
    addBoolParam: addBoolParam
};

function executeCliTask(runTaskFunc) {
    process.env.JFROG_CLI_HOME = jfrogFolderPath;
    process.env.JFROG_CLI_OFFER_CONFIG = false;

    runTaskCbk = runTaskFunc;
    if (fs.existsSync(customCliPath)) {
        runCbk(customCliPath);
    } else if (fs.existsSync(versionedCliPath)) {
        runCbk(versionedCliPath);
    } else {
        createCliDirs();
        downloadCli(0).then(() => {
            runCbk(versionedCliPath);
        });
    }
}

function executeCliCommand(cliCommand, runningDir) {
    try {
        execSync(cliCommand, {cwd: runningDir, stdio: [0, 1, 2]});
    } catch (ex) {
        // Error occurred
        return ex
    }
}

function cliJoin() {
    let command = "";
    for (let i = 0; i < arguments.length; ++i) {
        let arg = arguments[i];
        if (arg.length > 0) {
            command += (command === "") ? arg : (" " + arg);
        }
    }
    return command;
}

function quote(str) {
    return "\"" + str + "\"";
}

function addArtifactoryCredentials(cliCommand, artifactoryService) {
    let artifactoryUser = tl.getEndpointAuthorizationParameter(artifactoryService, "username", true);
    let artifactoryPassword = tl.getEndpointAuthorizationParameter(artifactoryService, "password", true);
    // Check if should make anonymous access to artifactory
    if (artifactoryUser === "") {
        artifactoryUser = "anonymous";
        cliCommand = cliJoin(cliCommand, "--user=" + quote(artifactoryUser));
    } else {
        cliCommand = cliJoin(cliCommand, "--user=" + quote(artifactoryUser), "--password=" + quote(artifactoryPassword));
    }
    return cliCommand
}

function addStringParam(cliCommand, inputParam, cliParam) {
    let val = tl.getInput(inputParam, false);
    if (val !== null) {
        cliCommand = cliJoin(cliCommand, "--" + cliParam + "=" + quote(val))
    }
    return cliCommand
}

function addBoolParam(cliCommand, inputParam, cliParam) {
    let val = tl.getBoolInput(inputParam, false);
    cliCommand = cliJoin(cliCommand, "--" + cliParam + "=" + val);
    return cliCommand
}

function checkCliVersion(cliPath) {
    let cliCommand = cliJoin(cliPath, "--version");
    try {
        let res = execSync(cliCommand);
        let detectedVersion = String.fromCharCode.apply(null, res).split(' ')[2].trim();
        if (detectedVersion === version) {
            console.log("JFrog CLI version: " + detectedVersion);
        } else {
            console.warn("Expected to find version " + version + " of JFrog CLI at " + cliPath + ". Found version " + detectedVersion + " instead.");
        }
    } catch (ex) {
        console.error("Failed to get JFrog CLI version: " + ex);
    }
}

function runCbk(cliPath) {
    console.log("Running jfrog-cli from " + cliPath + ".");
    checkCliVersion(cliPath);
    runTaskCbk(cliPath)
}

function createCliDirs() {
    if (!fs.existsSync(jfrogFolderPath)) {
        fs.mkdirSync(jfrogFolderPath);
    }

    if (!fs.existsSync(path.join(jfrogFolderPath, version))) {
        fs.mkdirSync(path.join(jfrogFolderPath, version));
    }
}

function downloadCli(attemptNumber) {
    return new Promise((resolve, reject) => {
        let handleError = (err) => {
            if (attemptNumber <= MAX_CLI_DOWNLOADS_RETRIES) {
                console.log("Attempt #" + attemptNumber + " to download jfrog-cli failed, trying again.");
                downloadCli(++attemptNumber);
            } else {
                console.error(DOWNLOAD_CLI_ERR);
                reject(err);
            }
        };

        const cliTmpPath = versionedCliPath + ".tmp";

        // Perform download
        request.get(cliUrl, {json:false, resolveWithFullResponse:true}).then((response) => {
            // Check valid response
            if (response.statusCode < 200 || response.statusCode >= 300) {
                handleError("Received http response code " + response.statusCode);
            }

            // Write body to file
            fs.writeFileSync(cliTmpPath, response.body);

            // Validate checksum
            let stream = fs.createReadStream(cliTmpPath);
            let digest = crypto.createHash('sha256');

            stream.on('data', function(data) {
                digest.update(data, 'utf8')
            });

            stream.on('end', function() {
                let hex = digest.digest('hex');
                let rawChecksum = response.headers['x-checksum-sha256'];
                let trimmedChecksum = rawChecksum.split(',')[0];

                if (hex === trimmedChecksum) {
                    fs.move(cliTmpPath, versionedCliPath).then( () => {
                        if (!process.platform.startsWith("win")) {
                            fs.chmodSync(versionedCliPath, 0o555);
                        }
                        console.log("Finished downloading jfrog cli.");
                        resolve();
                    });
                } else { handleError("Checksum mismatch for downloaded jfrog cli.") }
            });
        }).catch((err) => {
            console.error(DOWNLOAD_CLI_ERR);
            tl.setResult(tl.TaskResult.Failed, err.message);
        })
    });
}

function getArchitecture() {
    let platform = process.platform;
    if (platform.startsWith("win")) {
        return "windows-amd64"
    }
    if (platform.includes("darwin")) {
        return "mac-386"
    }
    if (process.arch.includes("64")) {
        return "linux-amd64"
    }
    return "linux-386"
}

function getFileName() {
    let executable = "jfrog";
    if (process.platform.startsWith("win")) {
        executable += ".exe"
    }
    return executable
}