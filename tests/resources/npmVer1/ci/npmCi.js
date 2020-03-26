const testUtils = require('../../../testUtils');

const TEST_NAME = 'npmVer1';

let inputs = {
    buildName: 'npmTest',
    buildNumber: '2',
    collectBuildInfo: true,
    workingFolder: 'npmVer1',
    command: 'ci',
    sourceRepo: testUtils.getRepoKeys().npmVirtualRepo,
    arguments: '',
    threads: '4'
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'resources');
testUtils.runTask(testUtils.npmVer1, {}, inputs);
