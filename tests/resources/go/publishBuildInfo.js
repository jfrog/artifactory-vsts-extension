const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'Go Test',
    buildNumber: '3'
};

testUtils.runTask(testUtils.publish, {}, inputs);
