/*************************************************************************************************
  The MIT License (MIT)

  Copyright (c) 2015 THOMAS FORD
  
  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:
  
  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.
  
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
  
  AUTHOR: Thomas Ford
  DATE:   3/21/2015
  
  ------------------------------------------------------------------------------------------
  DATE:     3/23/15
  VERSION:  .1.1
  NOTE:     Added leftJoin(), avg(), and predicate for on().
  
  DATE:     3/26/15
  VERSION:  .1.2
  NOTE:     Minor corrections
  
  DATE:     3/30/15
  VERSION   .1.3
  NOTE:     Added ability to sort asc/desc on plain arrays
            concat() and union()
            
  DATE:     4/1/15
  VERSION   .1.4
  NOTE:     Added support for positional for orderBy and Select on {field: #} objects
 *************************************************************************************************/

var jinqJs = function (settings) {
    'use strict';

    /* Private Variables */
    var collections = [],
        result = [],
        groups = [],
        identityUsed = false;

    /* Constructor Code */
    if (typeof settings !== 'undefined') {
        jinqJs.settings = settings;
    }
    else {
        jinqJs.settings = {
            includeIdentity: false
        };
    }

    /* Private Methods (no prefix) */
    var isEmpty = function (array) {
        return (typeof array === 'undefined' ||
                array.length === 0);
    },

      isArray = function (array) {
          return (hasProperty(array, 'length') && !isString(array) && !isFunction(array));
      },

      isObject = function (obj) {
          return (obj !== null && obj.constructor === Object);
      },

      isString = function (str) {
          return (str !== null && str.constructor === String);
      },

      hasProperty = function (obj, property) {
          return (typeof obj[property] !== 'undefined');
      },

      isFunction = function (func) {
          return (typeof func === 'function');
      },

      arrayItemFieldValueExists = function (collection, field, value) {
          for (var index = 0; index < collection.length; index++) {
              if (collection[index][field] == value)
                  return true;
          }

          return false;
      },

      arrayFindFirstItem = function (collection, obj) {
          return arrayFindItem(collection, obj, true);
      },

      arrayFindItem = function (collection, obj, findFirst) {
          var row = null;
          var isMatch = false;
          var ret = [];

          findFirst = findFirst || false;
          for (var index = 0; index < collection.length; index++) {

              isMatch = false;
              for (var field in obj) {

                  row = collection[index];
                  if (row[field] != obj[field]) {
                      isMatch = false;
                      break;
                  }

                  isMatch = true;
              }

              if (isMatch) {
                  if (findFirst)
                      return row;
                  else
                      ret.push(row);
              }
          }

          return (ret.length === 0 ? null : ret);
      },

      condenseToFields = function (obj, fields) {
          var newObj = {};
          var field = null;

          for (var index = 0; index < fields.length; index++) {
              field = fields[index];

              if (hasProperty(obj, field))
                  newObj[field] = obj[field];
              else
                  newObj[field] = 0;
          }

          return newObj;
      },

     aggregator = function (args, predicate) {
         var collection = [];
         var keys = null;
         var values = null;
         var row = null;

         for (var index = 0; index < result.length; index++) {
             keys = condenseToFields(result[index], groups);
             values = condenseToFields(result[index], args);

             row = arrayFindFirstItem(collection, keys);
             if (row === null) {
                 row = {};
                 for (var keyField in keys)
                     row[keyField] = keys[keyField];

                 for (var valField in values)
                     row[valField] = predicate(row[valField], values[valField], JSON.stringify(keys) + valField);


                 collection.push(row);
             }
             else {
                 for (var vField in values) {
                     row[vField] = predicate(row[vField], result[index][vField], JSON.stringify(keys) + vField);
                 }
             }
         }

         return collection;
     },

      orderByComplex = function (complexFields) {
          var complex = null;
          var prior = null;
          var field = null;
          var firstField = null;
          var secondField = null;
          var priorFirstField = null;
          var priorSecondField = null;
          var order = 1;
          var lValue = null;
          var rValue = null;
          var isNumField = false;

          for (var index = 0; index < complexFields.length; index++) {
              prior = (index > 0 ? complexFields[index - 1] : null);
              complex = complexFields[index];
              field = (hasProperty(complex, 'field') ? complex.field : null);
              order = (hasProperty(complex, 'sort') && complex.sort === 'desc' ? -1 : 1);
              isNumField = (field !== null && !isNaN(field) ? true : false);
              
              result.sort(function (first, second) {
                  if (isNumField){
                    firstField = Object.keys(first)[field];
                    secondField = Object.keys(second)[field];
                    
                    if (prior !== null){
                      priorFirstField = Object.keys(first)[prior.field];
                      priorSecondField = Object.keys(second)[prior.field];
                    }
                  }
                  else
                  {
                    firstField = secondField = field;
                    
                    if (prior !== null)
                      priorFirstField = priorSecondField = prior.field;
                  }
                    
                  lValue = (field === null ? first : (isNaN(first[firstField]) ? first[firstField] : Number(first[firstField])));
                  rValue = (field === null ? second : (isNaN(second[secondField]) ? second[secondField] : Number(second[secondField])));

                  if (lValue < rValue && (prior === null || (field === null || first[priorFirstField] == second[priorSecondField])))
                      return -1 * order;

                  if (lValue > rValue && (prior === null || (field === null || first[priorFirstField] == second[priorSecondField])))
                      return 1 * order;

                  return 0;
              }
              );
          }
      },

      flattenCollection = function (collection) {
          var flatCollection = [];

          for (var index = 0; index < collection.length; index++)
              flatCollection = flatCollection.concat(collection[index]);

          return flatCollection;
      },

      /* Possible future use */
      pluckRowByMissingField = function (collection, args) {
          var ret = [];
          var bIsMissing = false;

          if (args.length === 0)
              return collection;

          for (var index = 0; index < collection.length; index++) {
              bIsMissing = false;
              for (var iArg = 0; iArg < args.length; iArg++) {
                  if (!hasProperty(collection[index], args[iArg])) {
                      bIsMissing = true;
                      break;
                  }
              }

              if (!bIsMissing)
                  ret.push(collection[index]);
          }

          return ret;
      },

      mergeObjectsFields = function (objects) {
          var obj = {};

          for (var index = 0; index < objects.length; index++) {
              for (var prop in objects[index]) {
                  obj[prop] = objects[index][prop];
              }
          }

          return obj;
      },

      convertToEmptyObject = function (obj) {
          var o = {};

          for (var field in obj)
              o[field] = '';

          return o;
      },

      onFromJoin = function (joinType, comparers) {
          var row = null;
          var ret = [];
          var matches = null;
          var collection = [];
          var startIndex = 1;

          if (!isArray(comparers) || comparers.length === 0 || collections.length === 0) return;

          switch (joinType) {
              case 'from':
                  //If we have just one pending collection then just return it, there is nothing to join it with
                  if (collections.length === 1) {
                      result = collections[0];
                      return;
                  }

                  collection = collections[0];
                  break;

              case 'inner':
              case 'left':
                  collection = result;
                  startIndex = 0;
                  break;

              default:
                  return;
          }

          for (var index = startIndex; index < collections.length; index++) {
              ret = [];

              collection.forEach(function (lItem) {

                  if (isFunction(comparers[0])) {
                      matches = [];
                      collections[index].forEach(function (item) {
                          if (comparers[0](lItem, item))
                              matches.push(item);
                      }
                      );

                      //This condition is used to handle left joins with a predicate
                      if (matches.length === 0) {
                          matches = null;
                      }
                  }
                  else {
                      row = condenseToFields(lItem, comparers);
                      matches = arrayFindItem(collections[index], row);
                  }

                  if (matches !== null) {
                      matches.forEach(function (rItem) {
                          ret.push(mergeObjectsFields([rItem, lItem]));
                      });
                  }
                  else {
                      if (joinType === 'left') {
                          if (collections[index].length > 0) {
                              //The order of merging objects is important here, right -> left
                              row = convertToEmptyObject(collections[index][0]);
                              row = mergeObjectsFields([row, lItem]);
                          }
                          ret.push(mergeObjectsFields([lItem, row]));
                      }
                  }
              });

              collection = ret;
          }

          collections = [];
          result = ret;
      },

      joinIt = function (joinType, args) {
          if (args.length === 0) return this;

          collections = [];
          collections.func = joinType;
          for (var index = 0; index < args.length; index++) {
            if (args[index].length > 0)             //Could be a url string here or an array here. Length is ok to use either way
                collections.push(args[index]);
          }
      };

    /* Exposed Methods (prefixed with _) */
    var _from = function () {
        var collection = null;
        var callback = null;

        if (arguments.length === 0) return this;
       
        for (var index = 0; index < arguments.length; index++) {
            if (arguments[index] === null || arguments[index].length === 0)
                continue;

            if (arguments.length == 2 && isFunction(arguments[1])) {
                collection = arguments[0];
                callback = arguments[1];
                index = arguments.length;
            }
            else {
                collection = arguments[index];

                //Check for a callback function we dont support asyn callbacks with multiple tables
                if (isFunction(collection))
                    continue;
            }

            if (isString(collection)) {
                var xmlhttp = new XMLHttpRequest();

                if (isFunction(callback)) {
                    xmlhttp.self = this;

                    xmlhttp.onreadystatechange = function () {
                        if (xmlhttp.response.length === 0)
                            return;

                        var response = JSON.parse(xmlhttp.response);

                        if (isArray(response))
                            collection = response;
                        else
                            collection = new Array(response);

                        collections.push(collection);
                        result = collection;

                        callback(this.self);
                    };
                }


                xmlhttp.open("GET", collection, isFunction(callback));
                xmlhttp.send();

                if (!isFunction(callback)) {

                    var response = JSON.parse(xmlhttp.response);

                    if (isArray(response))
                        collection = response;
                    else
                        collection = new Array(response);

                    collections.push(collection);
                }
            }
            else {
                collections.push(collection);
            }
        }

        collections.func = 'from';
        result = flattenCollection(collections);

        return (isFunction(callback) ? callback : this);
    },

    _select = function () {
        var fields = null;
        var fieldIsObject = false;
        var fieldIsPredicate = false;
        var collection = [];


        if (isEmpty(result))
            return [];

        var obj = null;
        var srcFieldName = null;
        var dstFieldName = null;

        if (jinqJs.settings.includeIdentity && !identityUsed) {
            _identity();
        }

        if (isEmpty(arguments)) {
            return result;
        }

        //Check if an Array of objects is passed in as first parameter
        if (isArray(arguments[0])) {
            fields = arguments[0];
            fieldIsObject = true;
        }
        else if (isFunction(arguments[0])) {
          fields = arguments[0];
          fieldIsPredicate = true;
        }
        else
            fields = arguments;

        for (var index = 0; index < result.length; index++) {
            obj = {};
            if (fieldIsPredicate)
            {
              obj = fields(result[index]);
            }
            else
            {
              for (var field = 0; field < fields.length; field++) {
                  if (fieldIsObject) {
                      if (hasProperty(fields[field], 'field'))
                      {
                          if (isNaN(fields[field].field))
                            srcFieldName = fields[field].field;
                          else
                            srcFieldName = Object.keys(result[index])[fields[field].field];
                      }
  
                      dstFieldName = (hasProperty(fields[field], 'text') ? fields[field].text : fields[field].field);
                  } else {
                      dstFieldName = srcFieldName = fields[field];
                  }
  
                  if (hasProperty(fields[field], 'value')) {
                      if (isFunction(fields[field].value))
                          obj[dstFieldName] = fields[field].value(result[index]);
                      else
                          obj[dstFieldName] = fields[field].value;
                  } else {
                      obj[dstFieldName] = (hasProperty( result[index], srcFieldName ) ? result[index][srcFieldName] : result[index]);
                  }
              }
            }

            collection.push(obj);
        }

        return collection;
    },
    
    _concat = function() {
        collections.func = null;
        
        for(var index=0;index<arguments.length;index++)
          result = result.concat(arguments[index]);
        
        return this;
    },

    _top = function (amount) {
        var totalRows = 0;

        //Check for a percentage
        if (Math.abs(amount) > 0 && Math.abs(amount) < 1) {
            totalRows = result.length * amount;
        }
        else
            totalRows = amount;

        if (amount < 0)
            result = result.slice(totalRows, (result.length - Math.abs(totalRows) * -1));
        else
            result = result.slice(0, totalRows);

        return this;
    },

    _bottom = function (amount) {
        _top(amount * -1);

        return this;
    },

    _where = function (predicate) {
        var collection = [];
        var isPredicateFunc = false;
        var condition = /([^\s]+)\s([<>=!*]{1,2})\s(.+)/;
        var isTruthy = false;

        if (typeof predicate === 'undefined')
            return this;

        isPredicateFunc = isFunction(predicate);

        for (var index = 0; index < result.length; index++) {
            var row = result[index];

            if (isPredicateFunc) {
                if (predicate(row))
                    collection.push(row);
            }
            else {
                for (var arg = 0; arg < arguments.length; arg++) {
                    var matches = arguments[arg].match(condition);

                    isTruthy = false;
                    if (matches === null || matches.length !== 4)
                        throw ('Invalid predicate!');

                    var operator = matches[2];
                    var lField = matches[1];
                    var rValue = matches[3];

                    switch (operator) {
                        case '<':
                            if (row[lField] < rValue) isTruthy = true;
                            break;

                        case '>':
                            if (row[lField] > rValue) isTruthy = true;
                            break;

                        case '!=':
                            if (row[lField] != rValue) isTruthy = true;
                            break;

                        case '=':
                        case '==':
                            if (row[lField] == rValue) isTruthy = true;
                            break;

                        case '<=':
                            if (row[lField] <= rValue) isTruthy = true;
                            break;

                        case '>=':
                            if (row[lField] >= rValue) isTruthy = true;
                            break;

                        case '*':
                            if (row[lField].indexOf(rValue) > -1) isTruthy = true;
                            break;
                    }

                    if (!isTruthy)
                        break;
                }

                if (isTruthy)
                    collection.push(row);
            }
        }

        result = collection;

        return this;
    },

    _distinct = function () {
        if (isEmpty(arguments)) return this;

        var collection = [];
        var row = null;
        var field = null;

        for (var index = 0; index < result.length; index++) {

            row = condenseToFields(result[index], arguments);
            for (var fieldIndex = 0; fieldIndex < arguments.length; fieldIndex++) {

                field = arguments[fieldIndex];
                if (!arrayItemFieldValueExists(collection, field, row[field])) {
                    collection.push(row);
                    break;
                }
            }
        }

        result = collection;

        return this;
    },

    _groupBy = function () {
        groups = arguments;

        return this;
    },

    _sum = function () {
        var sum = {};

        result = aggregator(arguments, function (lValue, rValue, keys) {
            var key = keys;//JSON.stringify(keys);

            if (!hasProperty(sum, key))
                sum[key] = 0;

            return sum[key] += rValue;
        });

        return this;
    },

    _avg = function () {
        var avg = {};

        result = aggregator(arguments, function (lValue, rValue, keys) {
            var key = JSON.stringify(keys);

            if (!hasProperty(avg, key))
                avg[key] = { count: 0, sum: 0 };

            avg[key].count++;
            avg[key].sum += rValue;

            return avg[key].sum / avg[key].count;
        });

        return this;
    },

    _count = function () {
        var total = {};

        result = aggregator(arguments, function (lValue, rValue, keys) {
            var key = JSON.stringify(keys);

            if (!hasProperty(total, key))
                total[key] = 0;

            return ++total[key];
        });

        return this;
    },

    _min = function () {
        var minValue = {};

        result = aggregator(arguments, function (lValue, rValue, keys) {
            var key = JSON.stringify(keys);
            if (!hasProperty(minValue, key))
                minValue[key] = 0;

            if (minValue[key] === 0 || rValue < minValue[key])
                minValue[key] = rValue;

            return minValue[key];
        });

        return this;
    },

    _max = function () {
        var maxValue = {};

        result = aggregator(arguments, function (lValue, rValue, keys) {
            var key = JSON.stringify(keys);
            if (!hasProperty(maxValue, key))
                maxValue[key] = 0;

            if (rValue > maxValue[key])
                maxValue[key] = rValue;

            return maxValue[key];
        });

        return this;
    },

    _identity = function () {
        var id = 1;
        var label = (arguments.length === 0 ? 'ID' : arguments[0]);

        identityUsed = true;
        for (var index = 0; index < result.length; index++) {
            result[index][label] = id++;
        }

        return this;
    },

    _orderBy = function () {
        var fields = arguments;

        if (arguments.length > 0 && isArray(arguments[0])) {
            orderByComplex(arguments[0]);
            return this;
        }

        result.sort(function (first, second) {
            var firstFields = JSON.stringify(condenseToFields(first, fields));
            var secondFields = JSON.stringify(condenseToFields(second, fields));

            if (firstFields < secondFields)
                return -1;

            if (firstFields > secondFields)
                return 1;

            return 0;   //Egual
        });

        return this;
    },
    
    _union = function() {
      if (arguments.length === 0 || !isArray(arguments[0]) || arguments[0].length === 0) return this;

      var collection = flattenCollection(arguments);

      _concat(collection);
      groups = [];      
      for(var field in arguments[0][0])
        groups.push(field);

      _count();
      
      return this;
    },

    _on = function () {
        if (arguments.length === 0 || !hasProperty(collections, 'func')) return this;

        onFromJoin(collections.func, arguments);
        collections.func = null;

        return this;
    },

    _join = function () {
        joinIt('inner', arguments);

        return this;
    },

    _leftJoin = function () {
        joinIt('left', arguments);

        return this;
    };

    return {
        from: _from,
        select: _select,
        top: _top,
        bottom: _bottom,
        where: _where,
        distinct: _distinct,
        groupBy: _groupBy,
        sum: _sum,
        count: _count,
        min: _min,
        max: _max,
        avg: _avg,
        identity: _identity,
        orderBy: _orderBy,
        on: _on,
        join: _join,
        leftJoin: _leftJoin,
        concat: _concat,
        union: _union
    };
};