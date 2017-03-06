const del = require('../methods/del');
const chai = require('chai');
const sinon = require('sinon');
const _ = require('lodash');
const dynamoose = require('dynamoose');
const AccessDeniedError = require('../errors/AccessDeniedError');
const InternalServerError = require('../errors/InternalServerError');
const chaiAsPromised = require("chai-as-promised");
const tu = require('./testutil');

chai.use(chaiAsPromised);
const expect = chai.expect;

const testModel = require('./testmodel.js');

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

const KEYS = {
    hashKey: 'hash',
    rangeKey: 'range'
};

function createMiddleware(options) {
    return del(testModel.model, options, KEYS);
}

function defaultStub() {
    sinon.stub(dynamoose.ddb(), 'deleteItem', function (params, callback){
        let res = Object.assign({}, testModel.getResponse);
        res.Attributes = Object.assign({}, res.Item);
        delete res.Item;
        if (params.ReturnValues !== 'ALL_OLD') {
            res = _.pick(res, 'hash', 'range');
        }
        callback(null, res);
    });
}

describe('dynarouter', function () {
    describe('del', function () {
        afterEach(function() {
            if (typeof dynamoose.ddb().deleteItem.restore === 'function')
                dynamoose.ddb().deleteItem.restore();
        });

        it('should respond with the deleted key', async function() {
            defaultStub();
            let middleware = createMiddleware({});
            let ctx = createContext();
            await middleware(ctx, () => {});
            expect(tu.untype(ctx.body)).to.deep.equal({
                success: true,
                data: _.pick(testModel.object, 'hash', 'range')
            });
            expect(dynamoose.ddb().deleteItem.called).to.be.true;
        });

        it('should respond with an item instance', async function() {
            defaultStub();
            let middleware = createMiddleware({
                update: true
            });
            let ctx = createContext();
            await middleware(ctx, () => {});
            expect(tu.untype(ctx.body)).to.deep.equal({
                success: true,
                data: testModel.object
            });
            expect(dynamoose.ddb().deleteItem.called).to.be.true;
        });

        it('should run another function in parallel and merge the output with the item', async function() {
            defaultStub();
            let middleware = createMiddleware({
                update: true,
                parallel: {
                    actions: [
                        (ctx) => new Promise((resolve, reject) =>
                                    setTimeout(() => resolve('Parallel!'), 10))
                    ],
                    merge: (ctx, results) => Object.assign(results[0], {parallel: results[1]})
                }
            });
            let ctx = createContext();
            await middleware(ctx, () => {});
            expect(tu.untype(ctx.body)).to.deep.equal({
                success: true,
                data: Object.assign({}, testModel.object, {parallel: 'Parallel!'})
            });
            expect(dynamoose.ddb().deleteItem.called).to.be.true;
        });

        it('should respond with an item instance with added property "test"', async function() {
            defaultStub();
            let middleware = createMiddleware({
                update: true,
                after: (ctx, data) => Object.assign({}, data, {test: true})
            });
            let ctx = createContext();
            await middleware(ctx, () => {});
            expect(tu.untype(ctx.body)).to.deep.equal({
                success: true,
                data: Object.assign({}, testModel.object, {test: true})
            });
            expect(dynamoose.ddb().deleteItem.called).to.be.true;
        });

        /*
        it('should throw an AccessDeniedError before deleteItem is called', async function() {
            defaultStub();
            let middleware = createMiddleware({
                preAuthorize: (ctx, data) => false
            });
            let ctx = createContext();
            
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(AccessDeniedError).then(() => {
                expect(dynamoose.ddb().deleteItem.called).to.be.false;
            });
        });*/

        it('should throw an InternalServerError', async function() {
            sinon.stub(dynamoose.ddb(), 'deleteItem', (params, cb) => {
                cb(new Error());
            });//.callsArg(1).withArgs(new Error(), null);
            let middleware = createMiddleware({});
            let ctx = createContext();
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(InternalServerError);
        });
    });
});