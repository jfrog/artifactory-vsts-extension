const testUtils = require('../../../testUtils');

let inputs = {
    buildName: 'npm Test',
    buildNumber: '2',
    collectBuildInfo: true,
    workingFolder: 'npmVer1',
    command: 'pack and publish',
    targetRepo: testUtils.getRepoKeys().npmLocalRepo,
    arguments: ''
};

testUtils.runArtifactoryTask(testUtils.npmVer1, {}, inputs);
