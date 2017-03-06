const get = require('../methods/get');
const chai = require('chai');
const sinon = require('sinon');
const _ = require('lodash');
const dynamoose = require('dynamoose');
const AccessDeniedError = require('../errors/AccessDeniedError');
const InternalServerError = require('../errors/InternalServerError');
const NotFoundError = require('../errors/NotFoundError');
const chaiAsPromised = require("chai-as-promised");
const tu = require('./testutil');

chai.use(chaiAsPromised);
const expect = chai.expect;

const testModel = require('./testmodel.js');

const KEYS = {
    hashKey: 'hash',
    rangeKey: 'range'
};

function createContext() {
    return {
        params: {
            test_range: testModel.object.range,
            test_hash: testModel.object.hash
        },
        state: {
            keys: {}
        }
    };
}

function createMiddleware(options) {
    return get(testModel.model, options, KEYS);
}

function defaultStub() {
    sinon.stub(dynamoose.ddb(), 'getItem', function (params, callback){
        let res = Object.assign({}, testModel.getResponse);
        if (params.AttributesToGet) {
            res.Item = _.pick(res.Item, params.AttributesToGet);
        }
        callback(null, res);
    });
}

describe('dynarouter', function () {
    describe('get', function () {
        afterEach(function() {
            if (typeof dynamoose.ddb().getItem.restore === 'function')
                dynamoose.ddb().getItem.restore();
        });

        it('should respond with an item instance', async function() {
            defaultStub();
            let middleware = createMiddleware({});
            let ctx = createContext();
            await middleware(ctx, () => {});
            expect(ctx.body).to.deep.equal({
                success: true,
                data: new testModel.model(testModel.object)
            });
        });

        it('should respond with an item instance without the sProperty', async function() {
            defaultStub();
            let attr = ['hash', 'range', 'nProperty'];
            let middleware = createMiddleware({
                attributes: attr
            });

            let ctx = createContext();
            await middleware(ctx, () => {});

            expect(ctx.body).to.deep.equal({
                success: true,
                data: new testModel.model(_.pick(testModel.object, attr))
            });
        });

        it('should respond with an item instance where a property "a" is added', async function() {
            defaultStub();
            let middleware = createMiddleware({
                after: (ctx, data) => Object.assign({}, data, {a: true})
            });
            let ctx = createContext();
            await middleware(ctx, () => {});
            expect(ctx.body.data).to.have.property('a').which.is.true;
        });

/*        it('should throw an AccessDeniedError before getItem is called', async function() {
            defaultStub();
            let middleware = createMiddleware({
                preAuthorize: (ctx, data) => false
            });
            let ctx = createContext();
            
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(AccessDeniedError).then(() => {
                expect(dynamoose.ddb().getItem.called).to.be.false;
            });
        });

        it('should not throw an AccessDeniedError', async function() {
            defaultStub();
            let middleware = createMiddleware({
                preAuthorize: (ctx, data) => true
            });
            let ctx = createContext();
            
            return expect(middleware(ctx, () => {})).to.not.be.rejectedWith(AccessDeniedError);
        });*/

        it('should throw an AccessDeniedError after getItem is called', async function() {
            defaultStub();
            let middleware = createMiddleware({
                postAuthorize: (ctx, data) => false
            });
            let ctx = createContext();
            
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(AccessDeniedError).then(() => {
                expect(dynamoose.ddb().getItem.called).to.be.true;
            });
        });

        it('should not throw an AccessDeniedError after getItem is called', async function() {
            defaultStub();
            let middleware = createMiddleware({
                postAuthorize: (ctx, data) => true
            });
            let ctx = createContext();
            
            return expect(middleware(ctx, () => {})).to.not.be.rejectedWith(AccessDeniedError).then(() => {
                expect(dynamoose.ddb().getItem.called).to.be.true;
            });
        });

        it('should throw an InternalServerError', async function() {
            sinon.stub(dynamoose.ddb(), 'getItem').callsArg(1).withArgs(new Error(), null);
            let middleware = createMiddleware({});
            let ctx = createContext();
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(InternalServerError);
        });

        it('should throw a NotFoundError', async function() {
            sinon.stub(dynamoose.ddb(), 'getItem', function (params, callback){
                callback(null, {});
            });
            let middleware = createMiddleware({});
            let ctx = createContext();
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(NotFoundError);
        });
    });
});
