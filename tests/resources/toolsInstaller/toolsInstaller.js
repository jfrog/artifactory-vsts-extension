const testUtils = require('../../testUtils');

let inputs = {
    artifactoryResolverService: 'mock-service',
    cliInstallationRepo: testUtils.getRepoKeys().cliRepo
};

testUtils.runTask(testUtils.toolsInstaller, variables, inputs);
