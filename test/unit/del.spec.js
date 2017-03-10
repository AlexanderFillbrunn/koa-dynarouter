const del = require('../../methods/del');
const chai = require('chai');
const sinon = require('sinon');
const _ = require('lodash');
const AccessDeniedError = require('../../errors/AccessDeniedError');
const InternalServerError = require('../../errors/InternalServerError');
const chaiAsPromised = require("chai-as-promised");
const tu = require('../testutil');

chai.use(chaiAsPromised);
const expect = chai.expect;

const testModel = require('../testmodel.js');

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
    sinon.stub(testModel.model, 'delete', function(key, opt) {
        let res = Object.assign({}, testModel.object);
        if (opt.update) {
            return Promise.resolve(res);
        } else
            return Promise.resolve(_.pick(res, 'hash', 'range'))
    });
}

describe('dynarouter', function () {
    describe('del', function () {
        afterEach(function() {
            if (typeof testModel.model.delete.restore === 'function')
                testModel.model.delete.restore();
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
            testModel.model.delete.restore();
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
                    merge: (results, ctx) => Object.assign(results[0], {parallel: results[1]})
                }
            });
            let ctx = createContext();
            await middleware(ctx, () => {});
            expect(tu.untype(ctx.body)).to.deep.equal({
                success: true,
                data: Object.assign({}, testModel.object, {parallel: 'Parallel!'})
            });
        });

        it('should respond with an item instance with added property "test"', async function() {
            defaultStub();
            let middleware = createMiddleware({
                update: true,
                after: (data, ctx) => Object.assign({}, data, {test: true})
            });
            let ctx = createContext();
            await middleware(ctx, () => {});
            expect(tu.untype(ctx.body)).to.deep.equal({
                success: true,
                data: Object.assign({}, testModel.object, {test: true})
            });
        });

        it('should throw an InternalServerError', async function() {
            sinon.stub(testModel.model, 'delete', function(key, opt) {
                return Promise.reject(new Error());
            });
            let middleware = createMiddleware({});
            let ctx = createContext();
            return expect(middleware(ctx, () => {})).to.be.rejectedWith(InternalServerError);
        });
    });
});