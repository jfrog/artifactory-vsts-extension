const testUtils = require('../../testUtils');
const path = require('path');

const TEST_NAME = path.basename(__dirname);
const BUILD_NAME = TEST_NAME;
const BUILD_NUMBER = "2";

let variables = {
    "System.HostType": "build",
    "System.DefinitionId": BUILD_NAME,
    "Build.BuildDirectory": "/tmp/" + BUILD_NAME
};

let inputs = {
    "buildName": BUILD_NAME,
    "buildNumber": BUILD_NUMBER,
    "conanCommand": "Custom",
    "customArguments": "remote list",
    "collectBuildInfo": true
};

testUtils.runTask(testUtils.conan, variables, inputs);
