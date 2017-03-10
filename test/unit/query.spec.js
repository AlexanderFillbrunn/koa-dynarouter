const _ = require('lodash');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

const tu = require('../testutil');
const testModel = require('../testmodel.js');

const query = require('../../methods/query');
const AccessDeniedError = require('../../errors/AccessDeniedError');
const InternalServerError = require('../../errors/InternalServerError');
const BadRequestError = require('../../errors/BadRequestError');

chai.use(chaiAsPromised);
const expect = chai.expect;

function createBatchContext() {
    return {
        request: {
            query: {
                hashKeys: ['test1', 'test2', 'test3'],
                rangeKeys: [1,2,3]
            }
        },
        params: {},
        state: {}
    };
}

function createContext() {
    return {
        request: {
            query: {}
        },
        params: {},
        state: {}
    };
}

const KEYS = {
    hashKey: 'hash',
    rangeKey: 'range'
};

function createMiddleware(options) {
    return query(testModel.model, options, KEYS);
}

function batchStub() {
    sinon.stub(testModel.model, 'batchGet')
        .returns(Promise.resolve(createStubResponse()));
}

function createStubResponse() {
    let res = [];
    for (let i = 0; i < 3; i++) {
        res.push(Object.assign({}, testModel.object, {hash: 'test' + i}));
    }
    return res;
}

function scanStub() {
    let execSpy = sinon.spy(function() {
        return Promise.resolve(createStubResponse());
    });
    sinon.stub(testModel.model, 'scan', function() {
        return {
            exec: execSpy
        }
    });
    return execSpy;
}

describe('dynarouter', function () {
    describe('query', function () {

        afterEach(function() {
            if (typeof testModel.model.scan.restore == 'function')
                testModel.model.scan.restore();
            if (typeof testModel.model.batchGet.restore == 'function')
                testModel.model.batchGet.restore();
        });

        it('Should return a list of items using scan', async function() {
            let exec = scanStub();
            let middleware = createMiddleware({
                postAuthorize: (data, ctx) => true
            });
            let ctx = createContext();
            await middleware(ctx, () => {});

            let expected = {
                success: true,
                data: createStubResponse()
            };

            expect(tu.untype(ctx.body)).to.deep.equal(expected);
            expect(exec.calledOnce).to.be.true;
        });

        it('Should return a list of items using query', async function() {
            let exec = sinon.spy(function() {
                return Promise.resolve(createStubResponse());
            });
            let middleware = createMiddleware({
                query: (model, ctx) => {
                    return {exec: exec};
                },
            });
            let ctx = createContext();
            await middleware(ctx, () => {});

            let expected = {
                success: true,
                data: createStubResponse()
            };
            expect(tu.untype(ctx.body)).to.deep.equal(expected);
            expect(exec.calledOnce).to.be.true;
        });

        it('Should return a list of 2 items, filtering test1', async function() {
            let exec = scanStub();
            let middleware = createMiddleware({
                filter: (data, ctx) => data.hash !== 'test1'
            });
            let ctx = createContext();
            await middleware(ctx, () => {});

            let expected = {
                success: true,
                data: createStubResponse().filter(d => d.hash != 'test1')
            };

            expect(tu.untype(ctx.body)).to.deep.equal(expected);
            expect(exec.calledOnce).to.be.true;
        });

        it('Should return an empty list', async function() {
            let exec = scanStub();
            let middleware = createMiddleware({
                filter: (data, ctx) => false
            });
            let ctx = createContext();
            await middleware(ctx, () => {});

            let expected = {
                success: true,
                data: []
            };

            expect(tu.untype(ctx.body)).to.deep.equal(expected);
            expect(exec.calledOnce).to.be.true;
        });

        it('Should return a list of ids', async function() {
            let exec = scanStub();
            let middleware = createMiddleware({
                map: (data, ctx) => data.hash
            });
            let ctx = createContext();
            await middleware(ctx, () => {});

            let expected = {
                success: true,
                data: createStubResponse().map(d => d.hash)
            };

            expect(tu.untype(ctx.body)).to.deep.equal(expected);
            expect(exec.calledOnce).to.be.true;
        });

        it('Should return a list of objects using batch get', async function() {
            batchStub();
            let ctx = createBatchContext();
            let middleware = createMiddleware({});
            let expected = {
                success: true,
                data: createStubResponse()
            };
            await middleware(ctx, () => {});
            expect(tu.untype(ctx.body)).to.deep.equal(expected);
            expect(testModel.model.batchGet.calledOnce).to.be.true;
        });

        it('should call batchGet with the "attributes" options set', async function() {
            let data = createStubResponse().map(d => _.pick(d, 'hash'));
            sinon.stub(testModel.model, 'batchGet')
                .returns(Promise.resolve(data));
            let attrs = ['hash'];
            
            let ctx = createBatchContext();
            let middleware = createMiddleware({
                attributes: attrs
            });
            let expected = {
                success: true,
                data: data
            };
            await middleware(ctx, () => {});
            expect(tu.untype(ctx.body)).to.deep.equal(expected);
            expect(testModel.model.batchGet.calledOnce).to.be.true;
            expect(testModel.model.batchGet.firstCall.args[1]).to.have.property('attributes').which.deep.equals(attrs);
        });

        it('Should return a list of ids using batch get without range keys');

        it('Should return a list of ids using batch get with computed hash key', async function() {
            batchStub();
            let ctx = createBatchContext();
            delete ctx.request.query.hashKeys;
            let middleware = createMiddleware({
                hashKey: (ctx) => 'test'
            });
            let expected = {
                success: true,
                data: createStubResponse()
            };
            await middleware(ctx, () => {});
            expect(tu.untype(ctx.body)).to.deep.equal(expected);
            expect(testModel.model.batchGet.calledOnce).to.be.true;
            expect(testModel.model.batchGet.firstCall.args[0][0])
                .to.have.property('hash').which.equals('test');
        });

        it('Should throw a bad request error (missing hash keys)', async function() {
            batchStub();
            let ctx = createBatchContext();
            delete ctx.request.query.hashKeys;
            let middleware = createMiddleware({});
            let expected = {
                success: true,
                data: createStubResponse()
            };
            
            return expect(middleware(ctx, () => {})).to.eventually.be.rejectedWith(BadRequestError);
        });

        it('Should throw a bad request error (too many keys)', async function() {
            batchStub();
            let ctx = createBatchContext();
            ctx.request.query.hashKeys = [];
            ctx.request.query.rangeKeys = [];
            for (let i = 0; i < 101; i++) {
                ctx.request.query.hashKeys.push('test' + i);
                ctx.request.query.rangeKeys.push(i);
            }
            let middleware = createMiddleware({});
            let expected = {
                success: true,
                data: createStubResponse()
            };
            
            return expect(middleware(ctx, () => {})).to.eventually.be.rejectedWith(BadRequestError);
        });

        it('should throw an AccessDeniedError after scan is called', async function() {
            let exec = scanStub();
            let middleware = createMiddleware({
                postAuthorize: (data, ctx) => false
            });
            let ctx = createContext();
            return expect(middleware(ctx, () => {})).to.eventually.be.rejectedWith(AccessDeniedError).then(() => {
                expect(exec.called).to.be.true;
            });
        });

        it('should throw an InternalServerError', async function() {
            sinon.stub(testModel.model, 'scan').returns({
                exec: () => Promise.reject(new Error())
            });
            let middleware = createMiddleware({});
            let ctx = createContext();
            return expect(middleware(ctx, () => {})).to.eventually.be.rejectedWith(InternalServerError);
        });
    });
});