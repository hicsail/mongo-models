'use strict';
const Async = require('async');
const Hoek = require('hoek');
const Joi = require('joi');
const Mongodb = require('mongodb');


class MongoModels {
    constructor(attrs) {

        if (this.constructor.constructWithSchema) {
            this.constructor.validate(attrs, (err, value) => {

                if (err) {
                    return Object.defineProperty(this, '__err', {
                        writable: true,
                        enumerable: false,
                        value: err
                    });
                }

                attrs = value;
            });
        }

        Object.assign(this, attrs);
    }


    static connect(uri, options, callback) {

        Mongodb.MongoClient.connect(uri, options, (err, db) => {

            if (err) {
                return callback(err);
            }

            MongoModels.db = db;

            callback(null, db);
        });
    }


    static disconnect() {

        MongoModels.db.close();
    }


    static createIndexes() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        collection.createIndexes.apply(collection, args);
    }


    static validate(input, callback) {

        return Joi.validate(input, this.schema, callback);
    }


    validate(callback) {

        return Joi.validate(this, this.constructor.schema, callback);
    }


    static resultFactory() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const next = args.shift();
        const err = args.shift();
        let result = args.shift();

        if (err) {
            args.unshift(result);
            args.unshift(err);
            return next.apply(undefined, args);
        }

        const self = this;

        if (Object.prototype.toString.call(result) === '[object Array]') {
            result.forEach((item, index) => {

                result[index] = new self(item);
            });
        }

        if (Object.prototype.toString.call(result) === '[object Object]') {
            if (result.hasOwnProperty('value') && !result.hasOwnProperty('_id')) {
                if (result.value) {
                    result = new this(result.value);
                }
                else {
                    result = undefined;
                }
            }
            else if (result.hasOwnProperty('ops')) {
                result.ops.forEach((item, index) => {

                    result.ops[index] = new self(item);
                });

                result = result.ops;
            }
            else if (result.hasOwnProperty('_id')) {
                result = new this(result);
            }
        }

        args.unshift(result);
        args.unshift(err);
        next.apply(undefined, args);
    }


    static pagedFind(filter, fields, sort, limit, page, callback) {

        const self = this;
        const output = {
            data: undefined,
            pages: {
                current: page,
                prev: 0,
                hasPrev: false,
                next: 0,
                hasNext: false,
                total: 0
            },
            items: {
                limit,
                begin: ((page * limit) - limit) + 1,
                end: page * limit,
                total: 0
            }
        };

        fields = this.fieldsAdapter(fields);
        sort = this.sortAdapter(sort);

        Async.auto({
            count: function (done) {

                self.count(filter, done);
            },
            find: function (done) {

                const options = {
                    limit,
                    skip: (page - 1) * limit,
                    sort
                };

                self.find(filter, fields, options, done);
            }
        }, (err, results) => {

            if (err) {
                return callback(err);
            }

            output.data = results.find;
            output.items.total = results.count;

            // paging calculations
            output.pages.total = Math.ceil(output.items.total / limit);
            output.pages.next = output.pages.current + 1;
            output.pages.hasNext = output.pages.next <= output.pages.total;
            output.pages.prev = output.pages.current - 1;
            output.pages.hasPrev = output.pages.prev !== 0;
            if (output.items.begin > output.items.total) {
                output.items.begin = output.items.total;
            }
            if (output.items.end > output.items.total) {
                output.items.end = output.items.total;
            }

            callback(null, output);
        });
    }


    static fieldsAdapter(fields) {

        if (Object.prototype.toString.call(fields) === '[object String]') {
            const document = {};

            fields = fields.split(/\s+/);
            fields.forEach((field) => {

                if (field) {
                    const include = field[0] === '-' ? false : true;
                    if (!include) {
                        field = field.slice(1);
                    }
                    document[field] = include;
                }
            });

            fields = document;
        }

        return fields;
    }


    static sortAdapter(sorts) {

        if (Object.prototype.toString.call(sorts) === '[object String]') {
            const document = {};

            sorts = sorts.split(/\s+/);
            sorts.forEach((sort) => {

                if (sort) {
                    const order = sort[0] === '-' ? -1 : 1;
                    if (order === -1) {
                        sort = sort.slice(1);
                    }
                    document[sort] = order;
                }
            });

            sorts = document;
        }

        return sorts;
    }


    static aggregate() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        collection.aggregate.apply(collection, args);
    }


    static count() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        collection.count.apply(collection, args);
    }


    static distinct() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        collection.distinct.apply(collection, args);
    }


    static find() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        const callback = this.resultFactory.bind(this, args.pop());

        collection.find.apply(collection, args).toArray(callback);
    }


    static findOne() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        const callback = this.resultFactory.bind(this, args.pop());

        args.push(callback);
        collection.findOne.apply(collection, args);
    }


    static findOneAndUpdate() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        const callback = this.resultFactory.bind(this, args.pop());
        const filter = args.shift();
        const doc = args.shift();
        const options = Hoek.applyToDefaults({ returnOriginal: false }, args.pop() || {});

        args.push(filter);
        args.push(doc);
        args.push(options);
        args.push(callback);

        collection.findOneAndUpdate.apply(collection, args);
    }


    static findOneAndDelete() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        const callback = this.resultFactory.bind(this, args.pop());

        args.push(callback);
        collection.findOneAndDelete.apply(collection, args);
    }


    static findOneAndReplace() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        const callback = this.resultFactory.bind(this, args.pop());
        const filter = args.shift();
        const doc = args.shift();
        const options = Hoek.applyToDefaults({ returnOriginal: false }, args.pop() || {});

        args.push(filter);
        args.push(doc);
        args.push(options);
        args.push(callback);

        collection.findOneAndReplace.apply(collection, args);
    }


    static findById() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        const id = args.shift();
        const callback = this.resultFactory.bind(this, args.pop());
        let filter;

        try {
            filter = { _id: this._idClass(id) };
        }
        catch (exception) {
            return callback(exception);
        }

        args.unshift(filter);
        args.push(callback);
        collection.findOne.apply(collection, args);
    }


    static findByIdAndUpdate() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        const id = args.shift();
        const update = args.shift();
        const callback = this.resultFactory.bind(this, args.pop());
        const options = Hoek.applyToDefaults({ returnOriginal: false }, args.pop() || {});
        let filter;

        try {
            filter = { _id: this._idClass(id) };
        }
        catch (exception) {
            return callback(exception);
        }

        collection.findOneAndUpdate(filter, update, options, callback);
    }


    static findByIdAndDelete() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        const id = args.shift();
        const callback = this.resultFactory.bind(this, args.pop());
        const options = Hoek.applyToDefaults({}, args.pop() || {});
        let filter;

        try {
            filter = { _id: this._idClass(id) };
        }
        catch (exception) {
            return callback(exception);
        }

        collection.findOneAndDelete(filter, options, callback);
    }


    static insertMany() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        const callback = this.resultFactory.bind(this, args.pop());

        args.push(callback);
        collection.insertMany.apply(collection, args);
    }


    static insertOne() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        const callback = this.resultFactory.bind(this, args.pop());

        args.push(callback);
        collection.insertOne.apply(collection, args);
    }


    static updateMany() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        const filter = args.shift();
        const update = args.shift();
        const callback = args.pop();
        const options = Hoek.applyToDefaults({}, args.pop() || {});

        args.push(filter);
        args.push(update);
        args.push(options);
        args.push((err, results) => {

            if (err) {
                return callback(err);
            }

            callback(null, results.modifiedCount, results);
        });

        collection.updateMany.apply(collection, args);
    }


    static updateOne() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        const filter = args.shift();
        const update = args.shift();
        const callback = args.pop();
        const options = Hoek.applyToDefaults({}, args.pop() || {});

        args.push(filter);
        args.push(update);
        args.push(options);
        args.push((err, results) => {

            if (err) {
                return callback(err);
            }

            callback(null, results.modifiedCount, results);
        });

        collection.updateOne.apply(collection, args);
    }


    static replaceOne() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        const filter = args.shift();
        const doc = args.shift();
        const callback = args.pop();
        const options = Hoek.applyToDefaults({}, args.pop() || {});

        args.push(filter);
        args.push(doc);
        args.push(options);
        args.push((err, results) => {

            if (err) {
                return callback(err);
            }

            callback(null, results.modifiedCount, results);
        });

        collection.replaceOne.apply(collection, args);
    }


    static deleteOne() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        const callback = args.pop();

        args.push((err, results) => {

            if (err) {
                return callback(err);
            }

            callback(null, results.deletedCount);
        });

        collection.deleteOne.apply(collection, args);
    }


    static deleteMany() {

        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const collection = MongoModels.db.collection(this.collection);
        const callback = args.pop();

        args.push((err, results) => {

            if (err) {
                return callback(err);
            }

            callback(null, results.deletedCount);
        });

        collection.deleteMany.apply(collection, args);
    }


    static lookupById() {

        const self = this;
        const args = new Array(arguments.length);
        for (let i = 0; i < args.length; ++i) {
            args[i] = arguments[i];
        }

        const query = args.shift(); //local Find Query
        const foreignCollection = args.shift();
        const joinField = args.shift(); //local field to join
        const localField = args.shift(); //field to add or replace
        const callback = this.resultFactory.bind(this, args.pop());
        //local field filter
        const requiredField = {}; // need to add default filter if filtering to ensure joinField is in document results
        requiredField[joinField] = true;
        const localFields = args.shift() || null;
        localFields ? Hoek.applyToDefaults(requiredField,localFields) : {};

        const localOptions = Hoek.applyToDefaults({ returnOriginal: false }, args.shift() || {});
        const foreignFields = args.shift() || {};
        const foreignOptions = Hoek.applyToDefaults({ returnOriginal: false }, args.shift() || {});

        Async.auto({
            localDocuments: function (done) {

                self.find(query,localFields,localOptions, done);
            },
            objectIDs: ['localDocuments', function (results, done) {

                //convert string ID to ObjectID
                const objectID = [];
                results.localDocuments.map((document) => {

                    objectID.push(Mongodb.ObjectID(document[joinField]));
                });
                done(null, objectID);
            }],
            foreignDocuments: ['objectIDs', function (results, done) {

                foreignCollection.find({ _id: { $in: results.objectIDs } }, foreignFields, foreignOptions, done);
            }],
            map: ['foreignDocuments', function (results, done) {

                //create map to avoid n^2 loop
                const map = {};
                for (const document of results.foreignDocuments) {
                    map[document._id.toString()] = document;
                }
                done(null, map);
            }],
            match: ['map', function (results, done) {

                for (const document of results.localDocuments) {
                    document[localField] = results.map[document[joinField]];
                }
                done();
            }]
        }, (err, results) => {

            callback(err, results.localDocuments);
        });
    }


    static pagedLookupById(filter, sort, limit, page, foreignCollection, localField, foreignField, localFields, foreignFields, callback) {

        const self = this;
        const output = {
            data: undefined,
            pages: {
                current: page,
                prev: 0,
                hasPrev: false,
                next: 0,
                hasNext: false,
                total: 0
            },
            items: {
                limit,
                begin: ((page * limit) - limit) + 1,
                end: page * limit,
                total: 0
            }
        };

        localFields = this.fieldsAdapter(localFields);
        sort = this.sortAdapter(sort);
        foreignFields = this.fieldsAdapter(foreignFields);

        Async.auto({
            count: function (done) {

                self.count(filter, done);
            },
            find: function (done) {

                const options = {
                    limit,
                    skip: (page - 1) * limit,
                    sort
                };

                self.lookupById(filter, foreignCollection, foreignField, localField, localFields, options, foreignFields, done);
            }
        }, (err, results) => {

            if (err) {
                return callback(err);
            }

            output.data = results.find;
            output.items.total = results.count;

            // paging calculations
            output.pages.total = Math.ceil(output.items.total / limit);
            output.pages.next = output.pages.current + 1;
            output.pages.hasNext = output.pages.next <= output.pages.total;
            output.pages.prev = output.pages.current - 1;
            output.pages.hasPrev = output.pages.prev !== 0;
            if (output.items.begin > output.items.total) {
                output.items.begin = output.items.total;
            }
            if (output.items.end > output.items.total) {
                output.items.end = output.items.total;
            }

            callback(null, output);
        });
    }
}

MongoModels._idClass = Mongodb.ObjectID;
MongoModels.ObjectId = MongoModels.ObjectID = Mongodb.ObjectID;


module.exports = MongoModels;
