const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    "buildName": "buildDiscard",
    "buildNumber": "1",
    "fileSpec": JSON.stringify({
        files: [{
            pattern: testUtils.getTestLocalFilesDir(__dirname),
            target: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME)
        }]
    }),
    "collectBuildInfo": true,
    "failNoOp": true,
    "specSource": "taskConfiguration"
};

testUtils.runTask(testUtils.upload, {}, inputs);