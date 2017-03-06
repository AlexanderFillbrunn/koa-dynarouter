const dynamoose = require('dynamoose');

dynamoose.AWS.config.update({
  accessKeyId: 'AKID',
  secretAccessKey: 'SECRET',
  region: 'us-east-1'
});

const testSchema = new dynamoose.Schema({
    hash: {
        type: String,
        required: true,
        hashKey: true
    },
    range: {
        type: Number,
        required: true,
        rangeKey: true
    },
    sProperty: {
        type: String,
        index: {
            global: true,
            rangeKey: 'nProperty',
            name: 'index'
        }
    },
    nProperty: {
        type: Number
    }
});

const testModel = dynamoose.model('Test', testSchema,
                    {create: false, waitForActive: false});

module.exports = {
    model: testModel,
    object: {
        hash: 'myid',
        range: 3,
        sProperty: 'test',
        nProperty: 1337
    },
    getResponse: {
        Item: {
            hash: {S: 'myid'},
            range: {N : 3},
            sProperty: {S: 'test'},
            nProperty: {N: 1337}
        }
    }
};