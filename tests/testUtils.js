const tmrm = require('azure-pipelines-task-lib/mock-run');
const tl = require('azure-pipelines-task-lib/task');
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const syncRequest = require('sync-request');
const testDataDir = path.join(__dirname, "testData");
const devnull = require('dev-null');
const utils = require('artifactory-tasks-utils');
let artifactoryUrl = process.env.ADO_ARTIFACTORY_URL;
let artifactoryUsername = process.env.ADO_ARTIFACTORY_USERNAME;
let artifactoryPassword = process.env.ADO_ARTIFACTORY_PASSWORD;
let artifactoryAccessToken = process.env.ADO_ARTIFACTORY_ACCESS_TOKEN;
let artifactoryDockerDomain = process.env.ADO_ARTIFACTORY_DOCKER_DOMAIN;
let artifactoryDockerRepo = process.env.ADO_ARTIFACTORY_DOCKER_REPO;
let skipTests = process.env.ADO_ARTIFACTORY_SKIP_TESTS ? process.env.ADO_ARTIFACTORY_SKIP_TESTS.split(',') : [];

module.exports = {
    testDataDir: testDataDir,
    artifactoryDockerDomain: artifactoryDockerDomain,
    artifactoryDockerRepo: artifactoryDockerRepo,
    artifactoryUrl: artifactoryUrl,
    artifactoryPassword: artifactoryPassword,
    artifactoryUsername: artifactoryUsername,

    repoKey1: "ado-extension-test-repo1",
    repoKey2: "ado-extension-test-repo2",
    remoteMaven: "ado-extension-test-maven-remote",
    localMaven: "ado-extension-test-maven-local",
    virtualNuget: "ado-extension-test-nuget-virtual",
    remoteNuGet: "ado-extension-test-nuget-remote",
    localNuGet: "ado-extension-test-nuget-local",
    npmLocalRepoKey: "ado-npm-local-test",
    npmRemoteRepoKey: "ado-npm-remote-test",
    npmVirtualRepoKey: "ado-npm-virtual-test",
    repoConan: "ado-conan-local",
    virtualGo: "ado-extension-test-go-virtual",
    remoteGo: "ado-extension-test-go-remote",
    localGo: "ado-extension-test-go-local",

    promote: path.join(__dirname, "..", "tasks", "ArtifactoryBuildPromotion", "buildPromotion.js"),
    conan: path.join(__dirname, "..", "tasks", "ArtifactoryConan", "conanBuild.js"),
    docker: path.join(__dirname, "..", "tasks", "ArtifactoryDocker", "dockerBuild.js"),
    download: path.join(__dirname, "..", "tasks", "ArtifactoryGenericDownload", "Ver2", "downloadArtifacts.js"),
    upload: path.join(__dirname, "..", "tasks", "ArtifactoryGenericUpload", "uploadArtifacts.js"),
    maven: path.join(__dirname, "..", "tasks", "ArtifactoryMaven", "mavenBuild.js"),
    npm: path.join(__dirname, "..", "tasks", "ArtifactoryNpm", "npmBuild.js"),
    nuget: path.join(__dirname, "..", "tasks", "ArtifactoryNuget", "nugetBuild.js"),
    publish: path.join(__dirname, "..", "tasks", "ArtifactoryPublishBuildInfo", "publishBuildInfo.js"),
    discard: path.join(__dirname, "..", "tasks", "ArtifactoryDiscardBuilds", "discardBuilds.js"),
    go: path.join(__dirname, "..", "tasks", "ArtifactoryGo", "goBuild.js"),

    initTests: initTests,
    runTask: runTask,
    getTestName: getTestName,
    getTestLocalFilesDir: getTestLocalFilesDir,
    getLocalTestDir: getLocalTestDir,
    getRemoteTestDir: getRemoteTestDir,
    isRepoExists: isRepoExists,
    getBuild: getBuild,
    deleteBuild: deleteBuild,
    copyTestFilesToTestWorkDir: copyTestFilesToTestWorkDir,
    isWindows: isWindows,
    cleanUpAllTests: cleanUpAllTests,
    isSkipTest: isSkipTest
};

function initTests() {
    process.env.JFROG_CLI_OFFER_CONFIG = false;
    process.env.JFROG_CLI_LOG_LEVEL = "ERROR";
    tl.setStdStream(devnull());
    tl.setVariable("Agent.WorkFolder", testDataDir);
    tl.setVariable("Agent.TempDirectory", testDataDir);
    tl.setVariable("Agent.ToolsDirectory", testDataDir);

    deleteTestRepositories();
    createTestRepositories();
    recreateTestDataDir();
}

function runTask(testMain, variables, inputs) {
    variables["Agent.WorkFolder"] = testDataDir;
    variables["Agent.TempDirectory"] = testDataDir;
    variables["Agent.ToolsDirectory"] = testDataDir;
    variables["System.DefaultWorkingDirectory"] = testDataDir;

    let tmr = new tmrm.TaskMockRunner(testMain);

    setVariables(variables);
    setArtifactoryCredentials();
    mockGetInputs(inputs);

    tmr.registerMock('azure-pipelines-task-lib/mock-task', tl);
    tmr.run();
}

function recreateTestDataDir() {
    if (fs.existsSync(testDataDir)) {
        rimraf.sync(testDataDir);
    }
    fs.mkdirSync(testDataDir);
}

function getBuild(buildName, buildNumber) {
    return syncRequest('GET', utils.stripTrailingSlash(artifactoryUrl) + "/api/build/" + buildName + "/" + buildNumber, {
        headers: {
            "Authorization": getAuthorizationHeaderValue()
        }
    });
}

function deleteBuild(buildName) {
    syncRequest('DELETE', utils.stripTrailingSlash(artifactoryUrl) + "/api/build/" + buildName + "?deleteAll=1", {
        headers: {
            "Authorization": getAuthorizationHeaderValue()
        }
    });
}

function cleanUpAllTests() {
    if (fs.existsSync(testDataDir)) {
        rimraf(testDataDir, (err) => {
            if (err) {
                console.warn("Tests cleanup issue: " + err)
            }
        });
    }
    deleteTestRepositories();
}

function createTestRepositories() {
    createRepo(module.exports.repoKey1, JSON.stringify({ rclass: "local", packageType: "generic" }));
    createRepo(module.exports.repoKey2, JSON.stringify({ rclass: "local", packageType: "generic" }));
    createRepo(module.exports.localMaven, JSON.stringify({ rclass: "local", packageType: "maven" }));
    createRepo(module.exports.remoteMaven, JSON.stringify({ rclass: "remote", packageType: "maven", url: "https://jcenter.bintray.com" }));
    createRepo(module.exports.localNuGet, JSON.stringify({ rclass: "local", packageType: "nuget" }));
    createRepo(module.exports.virtualNuget, JSON.stringify({ rclass: "virtual", packageType: "nuget", repositories: [module.exports.remoteNuGet, module.exports.localNuGet] }));
    createRepo(module.exports.npmLocalRepoKey, JSON.stringify({ rclass: "local", packageType: "npm" }));
    createRepo(module.exports.npmRemoteRepoKey, JSON.stringify({ rclass: "remote", packageType: "npm", url: "https://registry.npmjs.org" }));
    createRepo(module.exports.npmVirtualRepoKey, JSON.stringify({ rclass: "virtual", packageType: "npm", repositories: ["ado-npm-local-test", "ado-npm-remote-test"] }));
    createRepo(module.exports.repoConan, JSON.stringify({ rclass: "local", packageType: "conan" }));
    createRepo(module.exports.localGo, JSON.stringify({ rclass: "local", packageType: "go" }));
    createRepo(module.exports.remoteGo, JSON.stringify({ rclass: "remote", packageType: "go", url: "https://gocenter.io" }));
    createRepo(module.exports.virtualGo, JSON.stringify({ rclass: "virtual", packageType: "go", repositories: ["ado-extension-test-go-local", "ado-extension-test-go-remote"] }));
}

function deleteTestRepositories() {
    deleteRepo(module.exports.repoKey1);
    deleteRepo(module.exports.repoKey2);
    deleteRepo(module.exports.localMaven);
    deleteRepo(module.exports.remoteMaven);
    deleteRepo(module.exports.localNuGet);
    deleteRepo(module.exports.virtualNuget);
    deleteRepo(module.exports.npmVirtualRepoKey);
    deleteRepo(module.exports.npmLocalRepoKey);
    deleteRepo(module.exports.npmRemoteRepoKey);
    deleteRepo(module.exports.repoConan);
    deleteRepo(module.exports.localGo);
    deleteRepo(module.exports.remoteGo);
    deleteRepo(module.exports.virtualGo);
}

function createRepo(repoKey, body) {
    syncRequest('PUT', utils.stripTrailingSlash(artifactoryUrl) + "/api/repositories/" + repoKey, {
        headers: {
            "Authorization": getAuthorizationHeaderValue(),
            "Content-Type": "application/json"
        },
        body: body
    });
}

function isRepoExists(repoKey) {
    let res = syncRequest('GET', utils.stripTrailingSlash(artifactoryUrl) + "/api/repositories/" + repoKey, {
        headers: {
            "Authorization": getAuthorizationHeaderValue()
        }
    });
    return res.statusCode === 200;
}

function deleteRepo(repoKey) {
    syncRequest('DELETE', utils.stripTrailingSlash(artifactoryUrl) + "/api/repositories/" + repoKey, {
        headers: {
            "Authorization": getAuthorizationHeaderValue(),
            "Content-Type": "application/json"
        }
    });
}

function getAuthorizationHeaderValue() {
    if (artifactoryAccessToken) {
        return "Bearer " + artifactoryAccessToken;
    } else {
        return "Basic " + new Buffer.from(artifactoryUsername + ":" + artifactoryPassword).toString("base64");
    }
}

function setArtifactoryCredentials() {
    tl.getEndpointUrl = () => {
        return artifactoryUrl;
    };
    tl.getEndpointAuthorizationParameter = (id, key, optional) => {
        if (key === "username") {
            return artifactoryUsername;
        }
        if (key === "password") {
            return artifactoryPassword;
        }
        if (key === "apitoken") {
            return artifactoryAccessToken;
        }
    };
}

/**
 * Returns an array of files contained in folderToCopy
 */
function getResourcesFiles(folderToCopy) {
    let dir = path.join(__dirname, "resources", folderToCopy);
    let files = fs.readdirSync(dir);
    let fullFilesPath = [];
    for (let i = 0; i < files.length; i++) {
        fullFilesPath.push(path.join(dir, files[i]))
    }
    return fullFilesPath;
}

/**
 * Copies all files exists in "tests/<testDirName>/<folderToCopy>" to a corresponding folder under "testDataDir/<testDirName>"
 * @param testDirName - test directory
 * @param folderToCopy - the folder to copy from the test
 */
function copyTestFilesToTestWorkDir(testDirName, folderToCopy) {
    let files = getResourcesFiles(path.join(testDirName, folderToCopy));

    if (!fs.existsSync(path.join(testDataDir, testDirName))) {
        fs.mkdirSync(path.join(testDataDir, testDirName));
    }

    for (let i = 0; i < files.length; i++) {
        fs.copyFileSync(files[i], path.join(getLocalTestDir(testDirName), path.basename(files[i])));
    }
}

function setVariables(variables) {
    for (let [key, value] of Object.entries(variables)) {
        tl.setVariable(key, value);
    }
}

/**
 * Override tl.getInput(), tl.getBoolInput() and tl.getPathInput() functions.
 * The test will return inputs[name] instead of using the original functions.
 * @param inputs - (String) - Test inputs
 */
function mockGetInputs(inputs) {
    tl.getInput = tl.getBoolInput = tl.getPathInput = (name, required) => {
        return inputs[name];
    };
}

function getTestName(testDir) {
    return path.basename(testDir);
}

function getLocalTestDir(testName) {
    return path.join(testDataDir, testName, "/");
}

function getTestLocalFilesDir(testDir) {
    return path.join(testDir, "files", "/")
}

function getRemoteTestDir(repo, testName) {
    return repo + "/" + testName + "/"
}

function isWindows() {
    return process.platform.startsWith("win");
}

function isSkipTest(skipValue) {
    return skipTests.indexOf(skipValue) !== -1;
}
