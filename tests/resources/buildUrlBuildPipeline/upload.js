const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    "buildName": "buildUrlBuildPipeline",
    "buildNumber": "3",
    "fileSpec": JSON.stringify({
        files: [{
            pattern: "*.nothing",
            target: testUtils.getRemoteTestDir(testUtils.repoKey1, TEST_NAME)
        }]
    }),
    "collectBuildInfo": true,
    "failNoOp": false
};

testUtils.runTask(testUtils.upload, {}, inputs);