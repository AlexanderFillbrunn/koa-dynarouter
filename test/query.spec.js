const _ = require('lodash');
const dynamoose = require('dynamoose');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

const tu = require('./testutil');
const testModel = require('./testmodel.js');

const query = require('../methods/query');
const AccessDeniedError = require('../errors/AccessDeniedError');
const InternalServerError = require('../errors/InternalServerError');

chai.use(chaiAsPromised);
const expect = chai.expect;

const response = {
    Items: [
        createResponseItem({hash: {S: 'test1'}}),
        createResponseItem({hash: {S: 'test2'}}),
        createResponseItem({hash: {S: 'test3'}})
    ]
};

function createContext() {
    return {
        request: {},
        params: {},
        state: {}
    };
}

function createResponseItem(i) {
    return Object.assign({}, testModel.getResponse.Item, i);
}

function createItem(i) {
    return Object.assign({}, testModel.object, i);
}

const KEYS = {
    hashKey: 'hash',
    rangeKey: 'range'
};

function createMiddleware(options) {
    return query(testModel.model, options, KEYS);
}

function defaultStub() {
    sinon.stub(dynamoose.ddb(), 'query', function (params, callback){
        let res = Object.assign({}, response);
        if (params.AttributesToGet) {
            res.Items = res.Items.map(i => _.pick(i, params.AttributesToGet));
        }
        callback(null, res);
    });
    sinon.stub(dynamoose.ddb(), 'scan', function (params, callback){
        let res = Object.assign({}, response);
        if (params.AttributesToGet) {
            res.Items = res.Items.map(i => _.pick(i, params.AttributesToGet));
        }
        callback(null, res);
    });
}

describe('dynarouter', function () {
    describe('query', function () {

        afterEach(function() {
            if (typeof dynamoose.ddb().query.restore === 'function')
                dynamoose.ddb().query.restore();
            if (typeof dynamoose.ddb().scan.restore === 'function')
                dynamoose.ddb().scan.restore();
        });

        it('Should return a list of items using query', async function() {
            defaultStub();
            let middleware = createMiddleware({
                postAuthorize: (ctx, data) => true
            });
            let ctx = createContext();
            await middleware(ctx, () => {});

            let expected = {
                success: true,
                data: [
                    createItem({hash: 'test1'}),
                    createItem({hash: 'test2'}),
                    createItem({hash: 'test3'})
                ]
            };

            expect(tu.untype(ctx.body)).to.deep.equal(expected);
        });

        it('Should return a list of items using query in ascending order', async function() {
            defaultStub();
            let middleware = createMiddleware({
                query: (ctx, model) => model.query('hash').eq('test1').ascending(),
            });
            let ctx = createContext();
            await middleware(ctx, () => {});

            let expected = {
                success: true,
                data: [
                    createItem({hash: 'test1'}),
                    createItem({hash: 'test2'}),
                    createItem({hash: 'test3'})
                ]
            };
            expect(tu.untype(ctx.body)).to.deep.equal(expected);
        });

        it('Should return a list of items using query in ascending order', async function() {
            defaultStub();
            let middleware = createMiddleware({
                query: (ctx, model) => model.query('hash').eq('test1').ascending().attributes(['hash']),
            });
            let ctx = createContext();
            await middleware(ctx, () => {});

            let expected = {
                success: true,
                data: [
                    createItem({hash: 'test1'}),
                    createItem({hash: 'test2'}),
                    createItem({hash: 'test3'})
                ].map(i => _.pick(i, 'hash'))
            };
            expect(tu.untype(ctx.body)).to.deep.equal(expected);
        });

        it('Should return a list of items using scan', async function() {
            defaultStub();
            let middleware = createMiddleware({});
            let ctx = createContext();
            await middleware(ctx, () => {});

            let expected = {
                success: true,
                data: [
                    createItem({hash: 'test1'}),
                    createItem({hash: 'test2'}),
                    createItem({hash: 'test3'})
                ]
            };

            expect(tu.untype(ctx.body)).to.deep.equal(expected);
        });

        it('Should call scan with ExclusiveStartKey', async function() {
            defaultStub();
            // For some reason Dynamoose wants the DynamoDB format here and does not marshal
            // plain JavaScript objects
            let startKey = {
                hash: {S: 'test1'},
                range: {N: '3'}
            };
            let middleware = createMiddleware({
                query: (ctx, model) => model.scan().startAt(startKey)
            });
            let ctx = createContext();
            await middleware(ctx, () => {});
            expect(dynamoose.ddb().scan.firstCall.args[0].ExclusiveStartKey).to.deep.equal(startKey);
        });

        it('Should return a list of items without sProperty', async function() {
            defaultStub();
            let attr = ['nProperty', 'hash', 'range'];
            let middleware = createMiddleware({
                query: (ctx, model) => model.scan().attributes(attr)
            });
            let ctx = createContext();
            await middleware(ctx, () => {});

            let expected = {
                success: true,
                data: [
                    createItem({hash: 'test1'}),
                    createItem({hash: 'test2'}),
                    createItem({hash: 'test3'})
                ].map(i => _.pick(i, attr))
            };

            expect(tu.untype(ctx.body)).to.deep.equal(expected);
        });

        it('Should return a list of 2 items, filtering test1', async function() {
            defaultStub();
            let middleware = createMiddleware({
                filter: (ctx, data) => data.hash !== 'test1'
            });
            let ctx = createContext();
            await middleware(ctx, () => {});

            let expected = {
                success: true,
                data: [
                    createItem({hash: 'test2'}),
                    createItem({hash: 'test3'})
                ]
            };

            expect(tu.untype(ctx.body)).to.deep.equal(expected);
        });

        it('Should return an empty list', async function() {
            defaultStub();
            let middleware = createMiddleware({
                filter: (ctx, data) => false
            });
            let ctx = createContext();
            await middleware(ctx, () => {});

            let expected = {
                success: true,
                data: []
            };

            expect(tu.untype(ctx.body)).to.deep.equal(expected);
        });

        it('Should return a list of ids', async function() {
            defaultStub();
            let middleware = createMiddleware({
                map: (ctx, data) => data.hash
            });
            let ctx = createContext();
            await middleware(ctx, () => {});

            let expected = {
                success: true,
                data: ['test1', 'test2', 'test3']
            };

            expect(tu.untype(ctx.body)).to.deep.equal(expected);
        });

        it('should throw an AccessDeniedError after scan is called', async function() {
            defaultStub();
            let middleware = createMiddleware({
                postAuthorize: (ctx, data) => false
            });
            let ctx = createContext();
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(AccessDeniedError).then(() => {
                expect(dynamoose.ddb().scan.called).to.be.true;
            });
        });

        it('should throw an InternalServerError', async function() {
            sinon.stub(dynamoose.ddb(), 'scan').callsArg(1).withArgs(new Error(), null);
            let middleware = createMiddleware({});
            let ctx = createContext();
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(InternalServerError);
        });
    });
});