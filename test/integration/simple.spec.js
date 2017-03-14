const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const router = require('koa-router');

const supertest = require('supertest');
const dynamoose = require('dynamoose');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const tu = require('../testutil');

const dynarouter = require('../../index');

const testModel = require('../testModel.js');

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('dynarouter', function () {
    describe('simple', function () {
        let server;
        let request;

        beforeEach(function() {
            sinon.stub(dynamoose.ddb(), 'getItem', function(params, cb) {
                cb(null, Object.assign({}, testModel.getResponse));
            });

            sinon.stub(dynamoose.ddb(), 'putItem', function(params, cb) {
                cb(null, {Attributes: Object.assign({}, testModel.getResponse.Item)});
            });

            sinon.stub(dynamoose.ddb(), 'deleteItem', function(params, cb) {
                cb(null, {});
            });

            sinon.stub(dynamoose.ddb(), 'scan', function(params, cb) {
                cb(null, {
                    Items: [
                        Object.assign({}, testModel.getResponse.Item, {hash: {S: 'test1'}}),
                        Object.assign({}, testModel.getResponse.Item, {hash: {S: 'test2'}}),
                        Object.assign({}, testModel.getResponse.Item, {hash: {S: 'test3'}})
                    ]
                });
            });

            sinon.stub(dynamoose.ddb(), 'updateItem', function(params, cb) {
                let res = Object.assign({}, testModel.getResponse.Item);
                res.sProperty.S = 'abc';
                cb(null, {
                    Attributes: res
                });
            });
        });

        before(function() {
            let app = new Koa();
            app.use(bodyParser());
            let mainRouter = router();

            let dr = dynarouter(testModel.model, {
                get: true,
                query: true,
                post: true,
                put: true,
                patch: true,
                del: true
            });

            mainRouter.use("/test", dr.routes()).use(dr.allowedMethods());

            app.use(async function(ctx, next) {
                try {
                    await next();
                } catch(e) {
                    console.log(e);
                    if (e.extra) {
                        console.log(e.extra);
                    }
                }
            });
            app.use(mainRouter.routes()).use(mainRouter.allowedMethods());
            server = app.listen();
            request = supertest(server);
        });

        after(function() {
            server.close();
        });

        afterEach(function() {
            dynamoose.ddb().getItem.restore();
            dynamoose.ddb().putItem.restore();
            dynamoose.ddb().deleteItem.restore();
            dynamoose.ddb().updateItem.restore();
            dynamoose.ddb().scan.restore();
        });

        it('should return a test model object', function(done) {
            request
                .get('/test/a/6')
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    expect(tu.untype(res.body.data)).to.deep.equal(testModel.object);
                    expect(dynamoose.ddb().getItem.calledOnce).to.be.true;
                    done();
                });
        });

        it('should create and return a test model object (PUT)', function(done) {
            request
                .put('/test/a/6')
                .send(testModel.object)
                .expect(201)
                .end((err, res) => {
                    if (err) throw err;
                    expect(tu.untype(res.body.data)).to.deep.equal(testModel.object);
                    expect(dynamoose.ddb().putItem.calledOnce).to.be.true;
                    done();
                });
        });

        it('should create and return a test model object (POST)', function(done) {
            request
                .post('/test')
                .send(testModel.object)
                .expect(201)
                .end((err, res) => {
                    if (err) throw err;
                    expect(tu.untype(res.body.data)).to.deep.equal(testModel.object);
                    expect(dynamoose.ddb().putItem.calledOnce).to.be.true;
                    done();
                });
        });

        it('should update and return a model', function(done) {
            let upd = {sProperty: 'abc'};
            request
                .patch('/test/a/4')
                .send(upd)
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    expect(tu.untype(res.body.data)).to.deep.equal(Object.assign({}, testModel.object, upd));
                    expect(dynamoose.ddb().updateItem.calledOnce).to.be.true;
                    done();
                });
        });

        it('should delete a resource', function(done) {
            request
                .del('/test/a/4')
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    expect(dynamoose.ddb().deleteItem.calledOnce).to.be.true;
                    expect(dynamoose.ddb().deleteItem.firstCall.args[0].Key).to.have.property('hash');
                    expect(dynamoose.ddb().deleteItem.firstCall.args[0].Key.hash.S).to.equal('a');
                    expect(dynamoose.ddb().deleteItem.firstCall.args[0].Key).to.have.property('range');
                    expect(dynamoose.ddb().deleteItem.firstCall.args[0].Key.range.N).to.equal('4');
                    done();
                });
        });

        it('should query a resource and return multiple items', function(done) {
            request
                .get('/test')
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    expect(dynamoose.ddb().scan.calledOnce).to.be.true;
                    expect(res.body.data.length).to.equal(3);
                    done();
                });
        });
    });
});