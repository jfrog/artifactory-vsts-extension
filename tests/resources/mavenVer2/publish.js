const testUtils = require('../../testUtils');

let inputs = {
    buildName: 'Mavenbuild',
    buildNumber: '3'
};

testUtils.runTask(testUtils.publish, {}, inputs);
