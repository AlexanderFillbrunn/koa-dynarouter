const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const router = require('koa-router');
const _ = require('lodash');

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
    describe('jwt', function () {
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
                let res = _.cloneDeep(testModel.getResponse.Item);
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
                globals: {
                    jwt: 'testkey'
                },
                get: true,
                query: true,
                post: true,
                put: true,
                patch: true,
                del: true
            });

            mainRouter.use("/test", dr.routes()).use(dr.allowedMethods());
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

        it('should return status 401 (GET)', function(done) {
            request
                .get('/test/a/6')
                .expect(401)
                .end((err, res) => {
                    if (err) throw err;
                    done();
                });
        });

        it('should return status 401 (PUT)', function(done) {
            request
                .put('/test/a/6')
                .send(testModel.object)
                .expect(401)
                .end((err, res) => {
                    if (err) throw err;
                    done();
                });
        });

        it('should return status 401 (POST)', function(done) {
            request
                .post('/test')
                .send(testModel.object)
                .expect(401)
                .end((err, res) => {
                    if (err) throw err;
                    done();
                });
        });

        it('should return status 401 (PATCH)', function(done) {
            let upd = {sProperty: 'abc'};
            request
                .patch('/test/a/4')
                .send(upd)
                .expect(401)
                .end((err, res) => {
                    if (err) throw err;
                    done();
                });
        });

        it('should return status 401 (DELETE)', function(done) {
            request
                .del('/test/a/4')
                .expect(401)
                .end((err, res) => {
                    if (err) throw err;
                    done();
                });
        });

        it('should return status 401 (QUERY)', function(done) {
            request
                .get('/test')
                .expect(401)
                .end((err, res) => {
                    if (err) throw err;
                    done();
                });
        });
    });
});