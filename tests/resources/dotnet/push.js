const testUtils = require('../../testUtils');
const path = require('path');
const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    buildName: 'DotNET Test',
    buildNumber: '7',
    command: 'push',
    targetDeployRepo: testUtils.getRepoKeys().nugetLocalRepo,
    pathToNupkg: path.join(testUtils.getLocalTestDir(TEST_NAME), 'nugetTest*.nupkg'),
    collectBuildInfo: true
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'push');
testUtils.runTask(testUtils.dotnet, {}, inputs);
