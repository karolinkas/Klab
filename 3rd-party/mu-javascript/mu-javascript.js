/**
 *  'mujs' is a library for communicating with the meinUnterricht API. It provides different resource handler to
 *  communicate with the API in an esay way. Logging and token data storage is separated from the logic so that the
 *  library is able to run in any javascript capable enviornment. There are different transport methods to send 
 *  messages via http or websockets.
 *
 *  @author Frederik Rudeck <frederik.rudeck@googlemail.com>
 *  @version 0.4.11
 */
var mujs = {
  generator: {},
  logger: {},
  resources: {},
  stores: {},
  transports: {},
  utils: {},
  version: '0.4.11'
};


if (typeof window !== 'undefined') {
  window.mujs = mujs;
} else if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = mujs;
} else {
  mujs = mujs;
}


/**
 *  Create an api client.
 *
 *  @param {Object} options The config for the api client.
 *  @returns {Object} An api client or 'null' on error.
 *
 *  @example
 *  var client = mujs.createApiClient({
 *    clientIdPostfix: 'muw',
 *    hostname: 'localhost',
 *    port: '8095',
 *    debug: true,
 *    logger: 'console',
 *    maxParallelRequests: 1,
 *    ssl: true,
 *    tokenDataStore: 'cookie',
 *    tokenDataDomain: null,
 *    tokenDataKey: 'mujsTokenData',
 *    transports: ['WebSocket', 'Http'],
 *    preferredTransport: 'WebSocket'
 *  });
 */
mujs.createApiClient = function(options) {
  if (typeof options === 'undefined') {
    options = {};
  }
  
  try {
    return new mujs.Client(options);
  } catch (e) {
    return null;
  }
  return null;
};

/**
 *  The 'EventEmitter' class provides the functionality to (un)register handler for certain events and emit events with
 *  the given data.
 *  @constructor
 *
 *  @param {Array} events A list of events.
 *  @returns {Object} The 'EventEmitter' object for chaining.
 */
mujs.utils.EventEmitter = function(events) {
  this.events = (typeof events === 'undefined') ? [] : events;
  this.handler = {};
  for (var i = 0; i < this.events.length; i++) {
    this.handler[this.events[i]] = [];
  }
  
  return this;
};


/**
 *  Register the given event handler for the given topic.
 *
 *  @param {String} topic The event topic.
 *  @param {Function} callback The event handler callback function.
 */
mujs.utils.EventEmitter.prototype.on = function(topic, callback) {
  this.handler[topic].push(callback);
};


/**
 *  Unregister the given event handler for the given topic.
 *
 *  @param {String} topic The event topic.
 *  @param {Function} callback The event handler callback function.
 */
mujs.utils.EventEmitter.prototype.off = function(topic, callback) {
  if (this.handler[topic].length === 0) {
    return;
  }
  
  if (typeof callback === 'undefined') {
    this.handler[topic] = [];
  } else {
    var length = this.handler[topic].length;
    for (var i = 0; i < length; i++) {
      if (this.handler[topic][i] === callback) {
        this.handler[topic].splice(i, 1);
        break;
      }
    }
  }
};


/**
 *  Emit the given data for the given event topic.
 *
 *  @param {String} topic The event topic.
 *  @param {Object} data The event data to emit.
 */
mujs.utils.EventEmitter.prototype.emit = function(topic, data) {
  var listeners = this.handler[topic],
    length = listeners.length;
  
  for (var i = 0; i < length; i++) {
    listeners[i](data);
  }
};

/**
 *  Return a copy of the given source element.
 *
 *  @param {Random} source The element to copy.
 *  @returns {Random} The copied element.
 */
mujs.utils.copy = function(source) {
  if (typeof source === 'undefined') {
    return void 0;
  } else if (typeof source === 'number') {
    return Number(source);
  } else if (typeof source === 'string') {
    return String(source);
  } else if (typeof source === 'object') {
    return clone(source);
  } else if (typeof source === 'function') {
    return source.valueOf();
  } else if (typeof source === 'boolean') {
    return Boolean(source.valueOf());
  } else {
    return source;
  }
};


/**
 *  Return a clone of the given element.
 *
 *  @param {Random} source The element to clone.
 *  @returns {Random} The cloned element.
 */
mujs.utils.clone = function(source) {
  var clone;
  if (typeof source === 'undefined') {
    return void 0;
  } else if (source === null) {
    return null;
  } else if (source instanceof Array) {
    clone = [];
    for (var f = 0; f < source.length; f++) {
      clone.push(mujs.utils.copy(source[f]));
    }
  } else if (typeof source.constructor !== 'undefined' && typeof source.constructor.name === 'string' &&
             source.constructor.name === 'ObjectID') {
    clone = new source.constructor('' + source);
  } else if (typeof source.constructor === 'function' && source.constructor.name !== 'Object') {
    clone = new source.constructor(source);
  } else {
    clone = {};
    for (var i in source) {
      clone[i] = mujs.utils.copy(source[i]);
    }
  }
  return clone;
};


/**
 *  Extend the given target object with the elements from the source object.
 *
 *  @param {Boolean} doNotOverwrite Indicate to only copy a property if none already exists.
 *  @param {Object} target The target object that get new properties.
 *  @param {Array} sourceArray The Objects that hold properties to be copied.
 *  @param {Boolean} useConcatForArrays Indicate if arrays should be concatenated.
 *  @returns {Object} The extended object.
 */
mujs.utils.extendDeep = function(doNotOverwrite, target, sourceArray, useConcatForArrays) {
  if (typeof doNotOverwrite !== 'boolean') {
    doNotOverwrite = false;
  }
  
  if (typeof sourceArray !== 'object') {
    sourceArray = {};
  }
  
  if (sourceArray instanceof Array === false) {
    sourceArray = [ sourceArray ];
  }
  
  if (target === null) {
    target = {};
  }
  
  for (var n = 0; n < sourceArray.length; n++) {
    var source = {};
    source = mujs.utils.clone(sourceArray[n]);
    for (var i in source) {
      if (typeof target[i] === 'undefined') {
        target[i] = mujs.utils.copy(source[i]);
      } else if (typeof target[i] === 'function' ||
                 typeof target[i] === 'boolean' ||
                 typeof target[i] === 'number' ||
                 typeof target[i] === 'string' ||
                 typeof target[i] !== typeof source[i]) {
        if (doNotOverwrite === false) {
          target[i] = mujs.utils.copy(source[i]);
        }
      } else if (typeof target[i] === 'object') {
        var sourceIsArray = source[i] instanceof Array;
        var targetIsArray = target[i] instanceof Array;
        if (targetIsArray === true && sourceIsArray === true ) {
          if (typeof useConcatForArrays !== 'boolean') {
            useConcatForArrays = false;
          }
          if (useConcatForArrays === true) {
            target[i] = target[i].concat(source[i]);
          } else if (doNotOverwrite === false) {
            target[i] = mujs.utils.copy(source[i]);
          }
        } else if (targetIsArray !== sourceIsArray && doNotOverwrite === false) {
          target[i] = mujs.utils.copy(source[i]);
        } else if (targetIsArray === false && sourceIsArray === false) {
          target[i] = mujs.utils.extendDeep(doNotOverwrite, target[i], [ source[i] ]);
        }
      }
    }
  }
  return target;
};

/**
 *  The 'FileTransfer' class provides the functionality to transfer a given file to the server by splitting up the file
 *  into small chunks. Callbacks are executed on progress, complete and error. The 'FileTransfer' uses a own message
 *  queue that can be resumed and stopped.
 *  @constructor
 *
 *  @param {Uint8Array} binaryFile The binary file to transfer.
 *  @param {Object} metaData Meta data for the file, such as file name and type.
 *  @param {Object} callbacks The callbacks that are executed on progress, complete and error.
 *  @param {Object} client The client.
 *  @returns {Object} The 'FileTransfer' object for chaining.
 */
mujs.utils.FileTransfer = function(binaryFile, metaData, callbacks, client) {
  this.id = this._generateId();
  
  this.method = 'POST';
  this.resource = 'links';
  this.specifier = 'upload';
  this.version = '1.0.0';
  
  // the first char of the packet data
  this.checksum = [];
  
  this.binaryFile = binaryFile;
  this.binaryFileSize = this.binaryFile.length;
  
  // 12 KiB
  this.packetSize = 12000;
  this.maxNumberOfPackets = 50;
  this.receivedPackets = 0;
  
  this.numberOfPackets = Math.ceil(this.binaryFileSize / this.packetSize);
  // check if the number of packets is greater then 50 -> recalculate the packet size
  if (this.numberOfPackets > this.maxNumberOfPackets) {
    this.numberOfPackets = this.maxNumberOfPackets;
    this.packetSize = Math.ceil(this.binaryFileSize / this.numberOfPackets);
  }
  
  this.metaData = metaData;
  
  // setup transfer callbacks
  this.onError = (typeof callbacks.onError !== 'undefined') ? callbacks.onError : function() {};
  this.onCancel = (typeof callbacks.onCancel !== 'undefined') ? callbacks.onCancel : function() {};
  this.onComplete = (typeof callbacks.onComplete !== 'undefined') ? callbacks.onComplete : function() {};
  this.onProgress = (typeof callbacks.onProgress !== 'undefined') ? callbacks.onProgress : function() {};
  
  this.client = client;
  
  this.maxParallelMessageFunction = Math.ceil(this.numberOfPackets / 3);
  this.messageQueue = new mujs.utils.MessageQueue({maxParallelMessageFunction: this.maxParallelMessageFunction});
  this.messageQueue.stop();
  
  this._listenToClientEvents();
  
  return this;
};


/**
 *  Start the file transfer.
 */
mujs.utils.FileTransfer.prototype.start = function() {
  if (this.client.state === this.client.states.ONLINE) {
    this.messageQueue.resume();
  }
  
  // sending start message, after sending the start message the binary file is send split up in 100 packets
  this._sendStartMessage();
};


/**
 *  Stop the file transfer.
 */
mujs.utils.FileTransfer.prototype.stop = function() {
  this.messageQueue.stop();
};


/**
 *  Resume the file transfer.
 */
mujs.utils.FileTransfer.prototype.resume = function() {
  this.messageQueue.resume();
};


/**
 *  Cancel the file transfer.
 */
mujs.utils.FileTransfer.prototype.cancel = function() {
  this.client.logger.log('[mujs] - canceling file transfer ' + this.id);
  
  this.messageQueue.stop();
  this.messageQueue.empty();
  this.messageQueue.resume();
  
  this._sendCancelMessage();
};


/**
 *  Destroy the file transfer.
 */
mujs.utils.FileTransfer.prototype.destroy = function() {
  this.messageQueue.stop();
  this.messageQueue.empty();
  
  this.client.off('online', this._onOnline);
  this.client.off('offline', this._onOffline);
  
  this.binaryFile = void 0;
};



/**
 *  Add listeners for 'online' and 'offline' events from the client.
 */
mujs.utils.FileTransfer.prototype._listenToClientEvents = function() {
  var self = this;
  
  this._onOnline = function() {
    self.resume();
  };
  
  this._onOffline = function() {
    self.stop();
  };
  
  this.client.on('online', this._onOnline);
  this.client.on('offline', this._onOffline);
};


/**
 *  Send a start message.
 */
mujs.utils.FileTransfer.prototype._sendStartMessage = function() {
  var startMessage = this._message({
    expectedSize: this.binaryFileSize,
    id: this.id,
    maxParts: this.numberOfPackets,
    type: 'start'
  });
  
  if (this.client.options.debug) {
    this.startTime = Date.now();
  }
  
  var self = this;
  this._send(
    startMessage,
    function(errors, results) {
      if (errors === null || errors.length === 0) {
        self.client.logger.log('[mujs] - starting file transfer ' + self.id, startMessage);
        
        // sending file
        self._sendFileMessages();
      } else {
        self.onError(errors, results);
      }
    }
  );
};


/**
 *  Send file messages.
 */
mujs.utils.FileTransfer.prototype._sendFileMessages = function() {
  for (var i = 0; i < this.numberOfPackets; i++) {
    this._sendMessage()(i);
  }
};


/**
 *  Send a file message.
 */
mujs.utils.FileTransfer.prototype._sendMessage = function() {
  var self = this;
  return function(i) {
    self.checksum[i] = String.fromCharCode.apply(null,
      self.binaryFile.subarray(i * self.packetSize, i * self.packetSize + 1));
    
    var message = self._message({
      id: self.id,
      type: 'packet',
      packet: String.fromCharCode.apply(null,
        self.binaryFile.subarray(i * self.packetSize, i * self.packetSize + self.packetSize)),
      part: i
    });
    
    self._send(
      message,
      function(errors, results) {
        self.client.logger.log('[mujs] - transfered part ' + message.data.document.part + '/' + self.numberOfPackets +
          ' of file ' + self.id, message);
        
        if ((errors === null || errors.length === 0) &&
            typeof results.data !== 'undefined' && results.data.length > 0) {
          if (message.data.document.part !== results.data[0].part) {
            self.client.logger.error('[mujs] - transfered part ' + message.data.document.part + ' but received part ' +
              results.data[0].part, message, results);
          }
          
          self.onProgress({packetsReceived: results.data[0].packetsReceived, maxPackets: self.numberOfPackets});
          
          self.receivedPackets++;
          if (self.receivedPackets === self.numberOfPackets) {
            self._sendFinishMessage();
          }
        } else {
          self.onError(errors, results);
        }
      }
    );
  };
};


/**
 *  Send a finish message.
 */
mujs.utils.FileTransfer.prototype._sendFinishMessage = function() {
  var finishMessage = this._message({
    checksum: this.checksum.join(''),
    id: this.id,
    originalFileName: this.metaData.originalFileName,
    originalFileType: this.metaData.originalFileType,
    targetScreenId: this.metaData.targetScreenId,
    type: 'finish',
    uploadLink: this.metaData.uploadLink
  });
  
  var self = this;
  this._send(
    finishMessage,
    function(errors, results) {
      var time = '';
      if (self.client.options.debug && typeof self.startTime !== 'undefined') {
        time = ' in {' + (Date.now() - self.startTime) + 'ms}';
      }
      self.client.logger.log('[mujs] - finished file transfer ' + self.id + time, finishMessage);
      self.onComplete(errors, results);
      self.client._removeFinishedFileTransfer(self.id);
    }
  );
};


/**
 *  Send a cancel message.
 */
mujs.utils.FileTransfer.prototype._sendCancelMessage = function() {
  var cancelMessage = this._message({
    id: this.id,
    type: 'cancel'
  });
  
  var self = this;
  this._send(
    cancelMessage,
    function(errors, results) {
      self.client.logger.log('[mujs] - canceled file transfer ' + self.id, cancelMessage);
      self.onCancel(errors, results);
      self.client._removeFinishedFileTransfer(self.id);
    }
  );
};


/**
 *  Send the given message by queuing the message.
 *
 *  @param {Object} message The message object.
 *  @param {Function} callback The callback function that is executed to return the answer.
 */
mujs.utils.FileTransfer.prototype._send = function(message, callback) {
  this.messageQueue.enqueue(this.client._messageQueueFunction(message, callback));
};


/**
 *  Construct a message object with the given document.
 *
 *  @param {Object} document The document attribute of the message.
 *  @returns {Object} A message object.
 */
mujs.utils.FileTransfer.prototype._message = function(document) {
  return {
    id: mujs.utils.randomString(16, true, true, true, true),
    topic: this.method + '/' + this.resource + '/',
    data: {
      document: document,
      options: {},
      specifier: this.specifier,
      resourceVersion: this.version
    }
  };
};


/**
 *  Generate a file transfer ID.
 *
 *  @returns {String} The generated file transfer ID.
 */
mujs.utils.FileTransfer.prototype._generateId = function() {
  return mujs.utils.randomString(16, true, true, true, true);
};

/**
 *  The 'MessageQueue' class provides the functionality to queue messages and send one message at a time.
 *  @constructor
 *
 *  @param {Object} options The options for the message queue.
 *  @returns {Object} The 'MessageQueue' object for chaining.
 */
mujs.utils.MessageQueue = function(options) {
  this.queue = [];
  this.messageCount = 0;
  this.stopped = false;
  
  this.options = {
    maxParallelMessageFunction: 1
  };
  mujs.utils.extendDeep(false, this.options, options);
  
  return this;
};


/**
 *  Add the given message function to the message queue which is executed when a slot is available.
 *
 *  @param {Function} messageFunction The function that is executed when a slot is available.
 */
mujs.utils.MessageQueue.prototype.enqueue = function(messageFunction) {
  this.queue.push(this._messageFunction(messageFunction));
  
  if (!this.stopped && this.messageCount < this.options.maxParallelMessageFunction) {
    this.dequeue()();
  }
};


/**
 *  Return the next message function from the queue.
 *
 *  @returns {Function} The next message function to execute.
 */
mujs.utils.MessageQueue.prototype.dequeue = function() {
  return this.queue.shift();
};


/**
 *  Stop the message queue by setting the 'stopped' attribute to 'true'.
 */
mujs.utils.MessageQueue.prototype.stop = function() {
  this.stopped = true;
};


/**
 *  Resume the message queue.
 */
mujs.utils.MessageQueue.prototype.resume = function() {
  this.stopped = false;
  
  var messageFunction;
  for (var i = 0; i < (this.options.maxParallelMessageFunction - this.messageCount); i++) {
    messageFunction = this.dequeue();
    if (typeof messageFunction !== 'undefined') {
      messageFunction();
    }
  }
};


/**
 *  Empty the message queue.
 */
mujs.utils.MessageQueue.prototype.empty = function() {
  this.queue = [];
  this.messageCount = 0;
};


/**
 *  Return a function wrapper for the given worker function.
 *
 *  @param {Function} messageFunction The function to execute in the message queue.
 *  @returns {Function} The function wrapper for the given message function.
 */
mujs.utils.MessageQueue.prototype._messageFunction = function(messageFunction) {
  var self = this;
  return function() {
    self.messageCount++;
    
    messageFunction(
      function() {
        self.messageCount--;
        if (!self.stopped && self.queue.length !== 0) {
          self.dequeue()();
        }
      }
    );
  };
};

/**
 *  Create a random string.
 *
 *  @param {Number} length Number of chars in the generated string/ID.
 *  @param {Boolean} numbers Indicate if numbers should be in the string/ID.
 *  @param {Boolean} alphabetLowerCase Indicate if lower case chars should be in the string/ID.
 *  @param {Boolean} alphabetUpperCase Indicate if upper case chars should be in the string/ID.
 *  @param {Boolean} timestamp Indicate if a unix timestamp should be at the start of the string/ID.
 *  @returns {String} the random generated string/ID.
 */
mujs.utils.randomString = function(length, numbers, alphabetLowerCase, alphabetUpperCase, timestamp) {
  var id = '';
  
  if (typeof numbers !== 'boolean') {
    numbers = true;
  }
  
  if (typeof alphabetLowerCase !== 'boolean') {
    alphabetLowerCase = false;
  }
  
  if (typeof alphabetUpperCase !== 'boolean') {
    alphabetUpperCase = false;
  }
  
  if (typeof timestamp !== 'boolean') {
    timestamp = false;
  }
  
  
  if (timestamp === true) {
    id += new Date().getTime();
  }
  
  if (timestamp === true && alphabetLowerCase === false && numbers === false && alphabetUpperCase === false) {
    return id;
  }
  
  var chars_numbers = new Array('1','2','3','4','5','6','7','8','9','0');
  var chars_alphabet = new Array(
    'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z');
  var chars_upperCase = new Array(
    'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z');
  
  var idchars = new Array(0);
  if (numbers === true) {
    idchars = idchars.concat(chars_numbers);
  }
  
  if (alphabetLowerCase === true) {
    idchars = idchars.concat(chars_alphabet);
  }
  
  if (alphabetUpperCase === true) {
    idchars = idchars.concat(chars_upperCase);
  }
  
  var lengthIdChars = idchars.length;
  for (var i = 0; i < length; i++) {
    id += idchars[Math.floor(Math.random() * lengthIdChars)];
  }
  
  return id;
};

/**
 *  RTrim the given chars from the string.
 *
 *  @param {String} str The string to rtrim.
 *  @param {Array} chars The chars to remove from the right end. Defaults to 'space'.
 *  @returns {String} The trimmed string.
 */
mujs.utils.rtrim = function(str, chars) {
  chars = chars || '\\s';
  return str.replace(new RegExp('[' + chars + ']+$', 'g'), '');
};

/**
 *  The 'Client' class provides the basic functionality to send messages, as well as geting and storing an access
 *  token. If the access token is expired it will automatically get a new token.
 *  @constructor
 *
 *  @param {Object} options The config for the api client
 *  @returns {Object} The 'Client' object for chaining.
 */
mujs.Client = function(options) {
  mujs.utils.EventEmitter.call(this, ['online', 'offline', 'pushMessage', 'transportError', 'warnings']);
  
  // default options
  this.options = {
    clientIdPostfix: 'muw',
    hostname: 'api2.meinunterricht.de',
    port: '443',
    debug: true,
    excludeResources: {
      BaseResource: true
    },
    logger: 'console',
    maxParallelRequests: 1,
    ssl: true,
    tokenDataStore: 'cookie',
    tokenDataDomain: null,
    tokenDataKey: 'mujsTokenData',
    transports: ['WebSocket', 'Http'],
    preferredTransport: 'WebSocket'
  };
  
  // extend the default options with the given options
  mujs.utils.extendDeep(false, this.options, options);
  
  // limit clientId postfix to 3 chars
  this.options.clientIdPostfix = this.options.clientIdPostfix.substr(0, 3);
  
  // client id
  this.clientId = mujs.utils.randomString(12, true, true, true, true) + '-' + this.options.clientIdPostfix;
  
  // active transport method
  this.activeTransport = null;
  
  // client states
  this.states = {
    ONLINE: 'online',
    OFFLINE: 'offline'
  };
  this.state = this.states.OFFLINE;
  
  // transport protocols
  this.transportsProtocol = {
    'WebSocket': 'vw-protocol',
    'Http': 'http' + (this.options.ssl ? 's' : '' )
  };
  
  // stores the start time of a specific message
  this.messageTimes = {};
  
  // specifies that the message needs NO access token
  this.accessTokenExcludes = {};
  
  // stores the current binary transfers
  this.fileTransfers = {};
  
  // init the resource functions
  this._initResources();
  
  // create message queue
  this.messageQueue = new mujs.utils.MessageQueue({maxParallelMessageFunction: this.options.maxParallelRequests});
  this.messageQueue.stop();
  
  // create logger
  if (typeof this.options.logger !== 'string' && typeof this.options.logger !== 'function') {
    this.options.logger = mujs.logger.NoLogger;
  }
  
  if (typeof this.options.logger === 'string') {
    if (this.options.logger === 'console') {
      this.options.logger = mujs.logger.ConsoleLogger;
    } else {
      this.options.logger = mujs.logger.NoLogger;
    }
  }
  this.logger = new this.options.logger(this.options.debug);
  
  // create transports
  if (this.options.transports.length === 0) {
    this.logger.error('[mujs] - no transport given');
    throw '[mujs] - no transport given';
  }
  
  this.transports = {};
  var transport,
    transportOptions;
  for (var i = 0; i < this.options.transports.length; i++) {
    transport = this.options.transports[i];
    if (typeof mujs.transports[transport + 'Transport'] !== 'undefined') {
      transportOptions = {};
      transportOptions.clientId = this.clientId;
      transportOptions.hostname = this.options.hostname;
      transportOptions.port = this.options.port;
      transportOptions.ssl = this.options.ssl;
      transportOptions.protocol = this.transportsProtocol[transport];
      
      this.transports[transport] = new mujs.transports[transport + 'Transport'](transportOptions, this.logger);
    }
  }
  
  this._switchTransport(this.options.preferredTransport);
  
  // create token data store
  if (typeof this.options.tokenDataStore !== 'string' && typeof this.options.tokenDataStore !== 'function') {
    this.logger.error('[mujs] - no tokenDataStore given');
    throw '[mujs] - no tokenDataStore given';
  }
  
  if (typeof this.options.tokenDataStore === 'string') {
    if (this.options.tokenDataStore === 'localStorage') {
      this.options.tokenDataStore = mujs.stores.LocalStorageTokenDataStore;
    } else if (this.options.tokenDataStore === 'cookie') {
      this.options.tokenDataStore = mujs.stores.CookieTokenDataStore;
    } else {
      this.logger.error('[mujs] - wrong tokenDataStore parameter');
      throw '[mujs] - wrong tokenDataStore parameter';
    }
  }
  
  // create tokenDataStore options
  var tokenDataStoreOptions = {
    keyName: this.options.tokenDataKey
  };
  if (this.options.tokenDataDomain !== null) {
    tokenDataStoreOptions.domain = this.options.tokenDataDomain;
  }
  
  this.tokenDataStore = new this.options.tokenDataStore(tokenDataStoreOptions);
  
  return this;
};
mujs.Client.prototype = Object.create(mujs.utils.EventEmitter.prototype);


/**
 *  Initialize resources by creating new handler for each resource that is not excluded (options.excludeResources) and 
 *  stores the handler at the 'Client' instance with the resource name.
 *
 *  @example
 *  mujs.resources.Users -> this.users = new mujs.resources.Users(this);
 */
mujs.Client.prototype._initResources = function() {
  for (var resource in mujs.resources) {
    if (typeof this.options.excludeResources[resource] === 'undefined' || !this.options.excludeResources[resource]) {
      this[resource.charAt(0).toLowerCase() + resource.slice(1)] = new mujs.resources[resource](this);
    }
  }
};


/**
 *  Set the given state for the client state, if the state is different then the previous one. An state event is
 *  emitted.
 *
 *  @param {String} state The new client state.
 */
mujs.Client.prototype._setState = function(state) {
  if (this.state !== state) {
    this.state = state;
    this.logger.log('[mujs] - client is ' + state);
    this.emit(state, {});
  }
};


/**
 *  Switch the active transport method to the given transport method. The previous transport is deactivated and the new
 *  one is activated.
 *
 *  @param {String} transport The transport method.
 */
mujs.Client.prototype._switchTransport = function(transport) {
  if (this.activeTransport === transport) {
    return;
  }
  
  if (this.activeTransport !== null) {
    this.transports[this.activeTransport].deactivate();
    this.transports[this.activeTransport].off('online');
    this.transports[this.activeTransport].off('offline');
    this.transports[this.activeTransport].off('error');
    this.transports[this.activeTransport].off('pushMessage');
  }
  
  this.activeTransport = transport;
  this.transports[transport].on('online', this._onOnline.bind(this));
  this.transports[transport].on('offline', this._onOffline.bind(this));
  this.transports[transport].on('error', this._onTransportError.bind(this));
  this.transports[transport].on('pushMessage', this._onPushMessage.bind(this));
  this.transports[transport].activate();
};


/**
 *  Handle the 'online' event of the transport layer by resuming the message queue.
 *
 *  @param {Object} data The 'online' event data object.
 */
mujs.Client.prototype._onOnline = function(data) {
  this._setState(this.states.ONLINE);
  this.messageQueue.resume();
};


/**
 *  Handle the 'offline' event of the transport layer by stopping the message queue.
 *
 *  @param {Object} data The 'offline' event data object.
 */
mujs.Client.prototype._onOffline = function(data) {
  this._setState(this.states.OFFLINE);
  this.messageQueue.stop();
};


/**
 *  Handle the 'transportError; event by emitting the error data.
 *
 *  @param {Object} error The error object.
 */
mujs.Client.prototype._onTransportError = function(error) {
  this.emit('transportError', error);
};


/**
 *  Handle the 'pushMessage' event by emitting the received message.
 *
 *  @param {Object} pushMsg The received message.
 */
mujs.Client.prototype._onPushMessage = function(pushMsg) {
  var deserializedMessage = this._deserializeMessage(pushMsg);
  this.emit('pushMessage', deserializedMessage);
};


/**
 *  Deserialize the given message and return an object with errors and results.
 *
 *  @param {Object} msg The message to deserialize.
 *  @returns {Object} Errors and results.
 */
mujs.Client.prototype._deserializeMessage = function(msg) {
  // TODO: pass on all results
  var result = {};
  if (msg.results.length === 1) {
    result = msg.results[0];
    if (typeof msg.requestId !== 'undefined') {
      result.requestId = msg.requestId;
    }
  }
  
  if (typeof msg.warnings !== 'undefined' && msg.warnings.length > 0) {
    this.logger.log('[mujs] - warnings for ' + result.method + '/' + result.resource + '/' + result.specifier,
      msg.warnings);
    this.emit('warnings', msg.warnings);
  }
  
  // TODO: deserialize received data
  
  return {
    errors: msg.errors,
    results: result
  };
};


/**
 *  Check if the given message requires an access token.
 *
 *  @param {Object} msg The message object.
 *  @returns {Boolean} True if the message requires an access token. False otherwise.
 */
mujs.Client.prototype._msgRequiresAccessToken = function(msg) {
  var fullTopic = msg.topic + msg.data.specifier;
  
  if (typeof this.accessTokenExcludes[fullTopic] === 'undefined') {
    return true;
  }
  
  if (typeof this.accessTokenExcludes[fullTopic] !== 'undefined' && !this.accessTokenExcludes[fullTopic]) {
    return true;
  }
  
  return false;
};


/**
 *  Check if the access token is expired.
 *
 *  @returns {Boolean} True if the is expired. False otherwise.
 */
mujs.Client.prototype._accessTokenExpired = function() {
  var expiresIn = null;
  
  // get the expires_in parameter from the token data store
  var tokenData = this.tokenDataStore.getTokenData();
  if (tokenData !== null && typeof tokenData.expires_in !== 'undefined') {
    expiresIn = tokenData.timestamp + (tokenData.expires_in * 1000);
  }
  
  if (expiresIn === null || new Date().getTime() > expiresIn) {
    return true;
  }
  return false;
};


/**
 *  Return a 'messageQueue' function.
 *
 *  @param {Object} msg The message object.
 *  @param {Function} callback The callback function that is executed after an answer is received.
 */
mujs.Client.prototype._messageQueueFunction = function(msg, callback) {
  var self = this;
  return function(next) {
    self._checkTokenData(msg, function() {
      callback.apply(callback, arguments);
      next();
    });
  };
};


/**
 *  Check the token data before sending an message if the message requires an access token to be send. The function
 *  will send the message if a valid access token exists or a message doesn't require an access token. If the token is
 *  expired it tries to get a new token or send an error if no token is available.
 *
 *  @param {Object} msg The message object.
 *  @param {Function} callback The callback function that is executed after an answer is received.
 */
mujs.Client.prototype._checkTokenData = function(msg, callback) {
  var accessToken = null;
  
  // get the access_token parameter from the token data store
  var tokenData = this.tokenDataStore.getTokenData();
  if (tokenData !== null && typeof tokenData.access_token !== 'undefined') {
    accessToken = tokenData.access_token;
  }
  
  if (accessToken !== null) {
    if (this._accessTokenExpired()) {
      // TODO: get new access token with the refresh token in the background
      return this._returnError(
        'ACCESS_TOKEN_EXPIRED',
        'access token expired at ' + new Date(accessToken.timestamp + (accessToken.expires_in * 1000)),
        msg,
        callback
      );
    } else {
      this._send(msg, accessToken, callback);
    }
  } else {
    if (this._msgRequiresAccessToken(msg)) {
      return this._returnError(
        'MSG_REQUIRES_ACCESS_TOKEN',
        msg.topic + ' requires an access token',
        msg,
        callback
      );
    } else {
      this._send(msg, '', callback);
    }
  }
};


/**
 *  Send a given message over with the preferred transport to the server.
 *
 *  @param {Object} msg The message.
 *  @param {String} accessToken The access token for the request.
 *  @param {Function} callback A callback function that is executed when the server sends an answer.
 */
mujs.Client.prototype._send = function(msg, accessToken, callback) {
  if (typeof this.transports[this.activeTransport] !== 'undefined') {
    
    if (this.options.debug) {
      this.messageTimes[msg.id] = Date.now();
    }
    
    var self = this;
    this.transports[this.activeTransport].send(msg, accessToken, function(answer) {
      if (self.options.debug && typeof self.messageTimes[msg.id] !== 'undefined') {
        self.logger.log('[mujs] - '+ msg.topic + (typeof msg.data.specifier !== 'undefined' ? msg.data.specifier : '') +
          ' in {' + (Date.now() - self.messageTimes[msg.id]) + 'ms}');
        delete self.messageTimes[msg.id];
      }
      
      var deserializedMessage = self._deserializeMessage(answer);
      callback(deserializedMessage.errors, deserializedMessage.results);
    });
  } else {
    return this._returnError(
      'ACTIVE_TRANSPORT_NOT_DEFINED',
      'active transport ' + this.activeTransport + ' not defined.',
      msg,
      callback
    );
  }
};


/**
 *  Return an error by executing the given callback with the initialized error.
 *
 *  @param {String} errorCode The error code string.
 *  @param {String} description The short description of the error.
 *  @param {Object} msg The message object.
 *  @param {Function} callback The callback function that is executed to return the error.
 */
mujs.Client.prototype._returnError = function(errorCode, description, msg, callback) {
  callback(
    [{
      errorCode: errorCode,
      description: description
    }],
    {}
  );
};



/**
 *  Tries to login the user with the given username and password by obtaining an access token that is used for all
 *  further requests. This function is called by the 'Users' resource handler.
 *
 *  @param {String} username The email address of the user.
 *  @param {String} password The password of the user.
 *  @param {Boolean} storeToken Indicate if the token data should be stored in a cookie or in the local storage.
 *  @param {Function} callback The callback function that is executed to return the answer.
 */
mujs.Client.prototype._login = function(username, password, storeToken, callback) {
  var self = this;
  this._send(
    {
      id: mujs.utils.randomString(16, true, true, true, true),
      data: {},
      topic: 'GET/oauth/token',
      queryString: 'grant_type=password&username=' + encodeURIComponent(username) +
        '&password=' + encodeURIComponent(password)
    },
    '',
    function(errors, result) {
      if (typeof result.data !== 'undefined' && result.data.length === 1) {
        try {
          self.tokenDataStore.setTokenData(result.data[0], storeToken);
        } catch (e) {
          self.logger.error('[mujs] - tokenDataStore.setTokenData Error', e);
        }
      } else {
        self.logger.error('[mujs] - login error.', errors);
      }
      
      callback(errors, result);
    }
  );
};


/**
 *  Tries to log out the user by removing the stored token data. This function is called by the 'Users' resource
 *  handler.
 *
 *  @param {String} userId The ID of the current logged in user.
 *  @param {Function} callback The callback function that is executed to return the answer.
 */
mujs.Client.prototype._logout = function(userId, callback) {
  var tokenData = this.tokenDataStore.getTokenData();
  if (tokenData !== null && typeof tokenData.access_token !== 'undefined') {
    
    this.users.PUT.removeOauthToken({_id: userId, access_token: tokenData.access_token}, function(errors, results) {
      callback(errors, results);
    });
  }
  
  this.tokenDataStore.removeTokenData();
};


/**
 *  Remove the file transfer object with the given file transfer id.
 *
 *  @param {String} fileTransferId The ID of the file transfer that needs to be removed.
 */
mujs.Client.prototype._removeFinishedFileTransfer = function(fileTransferId) {
  if (typeof this.fileTransfers[fileTransferId] === 'undefined') {
    this.logger.error('[mujs] - file transfer ID (' + fileTransferId + ') does not exist.');
  } else {
    this.fileTransfers[fileTransferId].destroy();
    this.fileTransfers[fileTransferId] = void 0;
    delete this.fileTransfers[fileTransferId];
  }
};



/**
 *  Send a given message by calling the '_send' method of the client instance. It checks if the token data is available
 *  or tries to get new token data.
 *
 *  @param {Object} msg The message object contains a 'topic' and 'data' attribute.
 *  @param {Function} callback The callback function that is executed to return the answer.
 */
mujs.Client.prototype.send = function(msg, callback) {
  if (typeof msg.topic !== 'string') {
    return this._returnError(
      'MSG_TOPIC_HAS_WRONG_TYPE',
      'msg.topic has the wrong type.',
      msg,
      callback
    );
  }
  
  if (typeof msg.data !== 'object') {
    return this._returnError(
      'MSG_DATA_HAS_WRONG_TYPE',
      'msg.data has the wrong type.',
      msg,
      callback
    );
  }
  
  this.messageQueue.enqueue(this._messageQueueFunction(msg, callback));
};


/**
 *  Close the active transport method.
 *
 *  @param {Function} callback The callback function that is executed to return the answer.
 */
mujs.Client.prototype.close = function(callback) {
  if (this.activeTransport !== null && this.state === this.states.ONLINE) {
    this.transports[this.activeTransport].deactivate();
    this.activeTransport = null;
  }
  
  callback(null, {});
};

/**
 *  Return the stored token data or null if none exists in the given callback.
 *
 *  @param {Function} callback The callback function that is executed to return the answer.
 */
mujs.Client.prototype.getTokenData = function(callback) {
  var tokenData = this.tokenDataStore.getTokenData();
  if (tokenData !== null && (typeof tokenData.access_token === 'undefined' || this._accessTokenExpired())) {
    tokenData = null;
  }
  
  callback(null, tokenData);
};


/**
 *  Remove the stored token data.
 *
 *  @param {Function} callback The callback function that is executed to return the answer.
 */
mujs.Client.prototype.removeTokenData = function(callback) {
  this.tokenDataStore.removeTokenData();
  callback(null, {});
};

/**
 *  Return true if the token data exists, false otherwise.
 *
 *  @param {Function} callback The callback function that is executed to return the answer.
 */
mujs.Client.prototype.tokenDataExists = function(callback) {
  callback(null, this.tokenDataStore.tokenDataExists());
};


/**
 *  Reconnect the client to the specified hostanme and port with or without emitting events.
 *
 *  @param {String} hostanme The hostname.
 *  @param {Number} port The port.
 *  @param {Boolean} events Specifies to emit 'online' and 'offline' events during the reconnect.
 */
mujs.Client.prototype.reconnect = function(hostname, port, events) {
  var transport;
  for (var i = 0; i < this.options.transports.length; i++) {
    transport = this.options.transports[i];
    if (typeof mujs.transports[transport + 'Transport'] !== 'undefined') {
      this.transports[transport].options.hostname = hostname;
      this.transports[transport].options.port = port;
    }
  }
  
  if (!events) {
    var onlineTempHandler = this.handler.online;
    var offlineTempHandler = this.handler.offline;
    this.handler.online = [];
    this.handler.offline = [];
    
    // reattach handler when the active transport is deactivated
    var self = this;
    var reattachHandler = function() {
      self.transports[self.activeTransport].off('offline', reattachHandler);
      self.handler.online = onlineTempHandler;
      self.handler.offline = offlineTempHandler;
    };
    this.transports[this.activeTransport].on('offline', reattachHandler);
  }
  
  this.transports[this.activeTransport].deactivate();
  this.transports[this.activeTransport].activate();
};


/**
 *  Transfer the given file to the server.
 *
 *  @param {Uint8Array} binaryFile The binary file to transfer.
 *  @param {Object} metaData Meta data for the file, such as file name and type.
 *  @param {Object} callbacks The callbacks that are executed on progress, complete and error.
 *  @returns {String} The file transfer ID.
 */
mujs.Client.prototype.transferFile = function(binaryFile, metaData, callbacks) {
  if (typeof binaryFile === 'undefined' || typeof metaData === 'undefined') {
    return null;
  }
  
  if (typeof callbacks === 'undefined') {
    callbacks = {};
  }
  
  var fileTransfer = new mujs.utils.FileTransfer(binaryFile, metaData, callbacks, this);
  if (typeof this.fileTransfers[fileTransfer.id] !== 'undefined') {
    this.logger.error('[mujs] - file transfer with the same ID (' + fileTransfer.id + ') is in progress.');
    fileTransfer = void 0;
    return null;
  }
  
  this.fileTransfers[fileTransfer.id] = fileTransfer;
  fileTransfer.start();
  
  return fileTransfer.id;
};


/**
 *  Cancel the file transfer with the given ID.
 *
 *  @param {String} fileTransferId The ID of the file transfer.
 */
mujs.Client.prototype.cancelTransfer = function(fileTransferId) {
  if (typeof this.fileTransfers[fileTransferId] !== 'undefined') {
    this.fileTransfers[fileTransferId].cancel();
  } else {
    this.logger.log('[mujs] - file transfer with the ID (' + fileTransferId + ') does not exist.');
  }
};

/**
 *  Generate resource handler functions and adaptors for the given methods. The given client is used to send the
 *  messages to the server.
 *
 *  @param {Object} object The object to store the generated functions.
 *  @param {Object} client The api client to send the messages.
 *  @param {Object} methods The object which specifies which methods and specifier should be generated.
 *  @param {String} resource The name of the resource handler.
 *  @param {String} version The resource version.
 *
 *  @example
 *  var foo = {};
 *  var methods = {'GET': ['byUserId', 'byId'], 'RUN': ['reload']};
 *  mujs.generator.generateResourceFunctions(foo, client, methods, 'test', '1.0.0');
 *  
 *  ->
 *  foo = {
 *    GET: function(specifier, data, [options], callback) {
 *      // client.send ...
 *    },
 *    GET.byUserId: function(data, [options], callback) {
 *      GET('byUserId', data, [options], callback);
 *    },
 *    GET.byId: function(data, [options], callback) {
 *      GET('byId', data, [options], callback);
 *    },
 *    RUN: function(specifier, data, [options], callback) {
 *      // client.send ...
 *    },
 *    RUN.reload: function(data, [options], callback) {
 *      RUN('reload', data, [options], callback);
 *    },
 *    reload: function(data, [options], callback) {
 *      RUN.reload(data, [options], callback);
 *    },
 *    adaptors = {
 *      GET: {
 *        byUserId: function(data, options) {
 *          return {
 *            document: {
 *              // attributes of the given data object
 *            },
 *            options: options,
 *            specifier: 'byUserId',
 *            resourceVersion: '1.0.0'
 *          };
 *        },
 *        byId: function(data, options) {
 *          return {
 *            document: {
 *              // attributes of the given data object
 *            },
 *            options: options,
 *            specifier: 'byId',
 *            resourceVersion: '1.0.0'
 *          };
 *        },
 *      },
 *      RUN: {
 *        reload: function(data, options) {
 *          return {
 *            document: {
 *              // attributes of the given data object
 *            },
 *            options: options,
 *            specifier: 'reload',
 *            resourceVersion: '1.0.0'
 *          }
 *        }
 *      }
 *    }
 *  }
 */
mujs.generator.generateResourceFunctions = function(object, client, methods, resource, version) {
  for (var method in methods) {
    // generate method function
    object[method] = mujs.generator.generateFunction(object, client, method, resource);
    
    // generate adaptor structure
    if (typeof object.adaptors === 'undefined') {
      object.adaptors = {};
    }
    object.adaptors[method] = {};
    
    for (var i = 0; i < methods[method].length; i++) {
      var specifier = methods[method][i];
      
      // generate specifier shortcut function
      object[method][specifier] = mujs.generator.generateSpecifierWrapper(specifier);
      
      // generate adaptor function
      object.adaptors[method][specifier] = mujs.generator.generateAdaptorFunction(specifier, version);
      
      if (method === 'RUN') {
        object[specifier] = mujs.generator.generateRunSpecifierShortcut(object[method], specifier);
      }
    }
  }
};


/**
 *  Generate a function that sends the given data with the specifier and options to the server. The callback is
 *  executed to return the answer.
 *
 *  @param {Object} object The object to access the adaptors.
 *  @param {Object} client The api client to send the data.
 *  @param {String} method The method name.
 *  @param {String} resource The resource name.
 *  @returns {Function} The function which is executed if the given method is called.
 */
mujs.generator.generateFunction = function(object, client, method, resource) {
  // options are optional
  return function(specifier, data, options, _callback) {
    var callback = arguments[arguments.length - 1];
    
    if (typeof callback === 'undefined' || typeof callback !== 'function') {
      return client.logger.error('[mujs] ' + resource + '.' + method + ' has no callback.');
    }
    
    if (typeof options === 'undefined' || typeof options === 'function') {
      options = {};
    }
    
    if (typeof specifier === 'undefined') {
      specifier = 'undefined';
    }
    
    if (typeof object.adaptors[method] === 'undefined') {
      return callback(
        [{
          errorCode: 'ADAPTOR_NOT_EXIST',
          description: resource + '.adaptors.' + method + ' does not exist.'
        }],
        {}
      );
    }
    
    if (typeof object.adaptors[method][specifier] === 'undefined') {
      return callback(
        [{
          errorCode: 'SPECIFIER_NOT_EXIST',
          description: resource + '.adaptors.' + method + '.' + specifier + ' does not exist.'
        }],
        {}
      );
    }
    
    client.send(
      {
        id: mujs.utils.randomString(16, true, true, true, true),
        topic: method + '/' + resource + '/',
        data: object.adaptors[method][specifier](data, options)
      },
      callback
    );
  };
};


/**
 *  Generate a function that wraps the method function to pass in a specific specifier.
 *
 *  @param {String} specifier The name of the specifier.
 *  @return {Function} The specifier wrapper function.
 */
mujs.generator.generateSpecifierWrapper = function(specifier) {
  return function(data, options, _callback) {
    [].unshift.call(arguments, specifier);
    this.apply(null, arguments);
  };
};


/**
 *  Generate a function that returns the adaptor for the given specifier.
 *
 *  @param {String} specifier The name of the specifier.
 *  @param {String} version The resource version.
 *  @returns {Function} The function that returns the adaptor data.
 */
mujs.generator.generateAdaptorFunction = function(specifier, version) {
  return function(data, options) {
    var document = {};
    for (var i in data) {
      document[i] = data[i];
    }
    
    return {
      document: document,
      options: options,
      specifier: specifier,
      resourceVersion: typeof version === 'undefined' ? '0.0.0' : version
    };
  };
};


/**
 *  Generate a function that is executed as shortcut for the specifier method.
 *
 *  @param {Function} objectMethod The method function.
 *  @param {String} specifier The specifier name.
 *  @returns {Function} The function that is executed for the run specifier shortcut.
 */
mujs.generator.generateRunSpecifierShortcut = function(objectMethod, specifier) {
  return function() {
    objectMethod[specifier].apply(objectMethod, arguments);
  };
};

/**
 *  The 'ConsoleLogger' class provides the functionality to log messages to the browser console.
 *  @constructor
 *
 *  @param {Boolean} logging Indicate if logging is enabled or disabled.
 *  @returns {Object} The 'ConsoleLogger' object for chaining.
 */
mujs.logger.ConsoleLogger = function(logging) {
  this.setLogging(logging);
  
  return this;
};


/**
 *  Initialize the logger functions 'error' and 'log'.
 */
mujs.logger.ConsoleLogger.prototype._initLoggerFunctions = function() {
  if (this.logging) {
    if (Function.prototype.bind) {
      this.error = Function.prototype.bind.call(console.error, console);
      this.log = Function.prototype.bind.call(console.log, console);
    } else {
      this.error = function() {
        Function.prototype.apply.call(console.error, console, arguments);
      };
      this.log = function() {
        Function.prototype.apply.call(console.log, console, arguments);
      };
    }
  } else {
    this.error = function() {};
    this.log = function() {};
  }
};


/**
 *  Set the logging variable and reinitialize the logging functions.
 *
 *  @param {Boolean} logging Indicate if logging is enabled or disabled.
 */
mujs.logger.ConsoleLogger.prototype.setLogging = function(logging) {
  this.logging = logging;
  this._initLoggerFunctions();
};

/**
 *  The 'NoLogger' class is just a 'fake' implementation to fulfill the logger interface and provide 'error' and 'log'
 *  functions.
 *  @constructor
 *
 *  @param {Boolean} logging Indicate if logging is enabled or disabled.
 *  @returns {Object} The 'NoLogger' object for chaining.
 */
mujs.logger.NoLogger = function(logging) {
  this.error = function() {};
  this.log = function() {};
  
  return this;
};


/**
 *  Set the logging variable
 *
 *  @param {Boolean} logging Indicate if logging is enabled or disabled.
 */
mujs.logger.NoLogger.prototype.setLogging = function(logging) {
};

/**
 *  The 'BaseResource' class is the base class for all resource handler classes.
 *  @constructor
 *
 *  @param {String} name The resource name.
 *  @param {Object} client The api client.
 *  @param {String} version The resource version.
 *  @returns {Object} The 'BaseResource' object for chaining.
 */
mujs.resources.BaseResource = function(name, client, version) {
  this.name = name;
  this.client = client;
  this.version = version;
  
  // adaptors for the specified methods
  this.adaptors = {};
  
  return this;
};


/**
 *  Generate resource functions for the given methods.
 *
 *  @param {Object} methods The methods for which the functions are created.
 */
mujs.resources.BaseResource.prototype._generateResourceMethods = function(methods) {
  this.methods = methods;
  
  // generate resource access functions and adaptor functions for the specified methods and adaptors
  mujs.generator.generateResourceFunctions(this, this.client, this.methods, this.name, this.version);
};


/**
 *  Store the given access token excludes on the client.
 *
 *  @param {Object} excludes The messages for which the client needs NO access token.
 */
mujs.resources.BaseResource.prototype._setAccessTokenExcludes = function(excludes) {
  for (var method in excludes) {
    for (var i = 0; i < excludes[method].length; i++) {
      this.client.accessTokenExcludes[method + '/' + this.name + '/' + excludes[method][i]] = true;
    }
  }
};

/**
 *  The 'Billings' resource handler class to access the all billing related informations.
 *  @constructor
 *
 *  @param {Object} client The api client.
 *  @returns {Object} The 'Billings' object for chaining.
 */
mujs.resources.Billings = function(client) {
  mujs.resources.BaseResource.call(this, 'billings', client, '1.0.0');
  
  // generate resource methods and specifier
  this._generateResourceMethods({
    'DELETE': ['cancelLicence'],
    'GET': ['bankAccount', 'invoiceLink', 'invoices', 'licenceModels'],
    // 'POST': [''],
    'PUT': ['bankAccount', 'licence'],
    // 'RUN': ['']
  });
  
  return this;
};
mujs.resources.Billings.prototype = Object.create(mujs.resources.BaseResource.prototype);

/**
 *  The 'Configurations' resource handler class to access and manipulate configurations.
 *  @constructor
 *
 *  @param {Object} client The api client.
 *  @returns {Object} The 'Configurations' object for chaining.
 */
mujs.resources.Configurations = function(client) {
  mujs.resources.BaseResource.call(this, 'configurations', client, '1.0.0');
  
  // generate resource methods and specifier
  this._generateResourceMethods({
    'DELETE': ['byId'],
    'GET': ['all', 'byId', 'byIdList', 'byType', 'typeMappingExists'],
    'POST': ['one'],
    'PUT': ['byType', 'mapping'],
    // 'RUN': ['']
  });
  
  // specify messages that require NO access token
  this._setAccessTokenExcludes({
    // 'DELETE': [''],
    'GET': ['byType'],
    // 'POST': [''],
    // 'PUT': [''],
    // 'RUN': ['']
  });
  
  return this;
};
mujs.resources.Configurations.prototype = Object.create(mujs.resources.BaseResource.prototype);

/**
 *  The 'Desktops' resource handler class to access and manipulate the users desktops.
 *  @constructor
 *
 *  @param {Object} client The api client.
 *  @returns {Object} The 'Desktops' object for chaining.
 */
mujs.resources.Desktops = function(client) {
  mujs.resources.BaseResource.call(this, 'desktops', client, '1.0.0');
  
  // generate resource methods and specifier
  this._generateResourceMethods({
    'DELETE': ['byId'],
    'GET': ['byId', 'byIdList', 'byUserId', 'copyAllowedById', 'publicPlaylistsByClient', 'publicPlaylistsAll'],
    'POST': ['copy', 'desksfromuser', 'one'],
    'PUT': ['allowCopy', 'children', 'labels', 'list']
  });
  
  return this;
};
mujs.resources.Desktops.prototype = Object.create(mujs.resources.BaseResource.prototype);

/**
 *  The 'Documents' resource handler class to download documents.
 *  @constructor
 *
 *  @param {Object} client The api client.
 *  @returns {Object} The 'Documents' object for chaining.
 */
mujs.resources.Documents = function(client) {
  mujs.resources.BaseResource.call(this, 'documents', client, '1.0.0');
  
  // generate resource methods and specifier
  this._generateResourceMethods({
    // 'DELETE': [''],
    'GET': ['byDownloadPath', 'byId', 'distinct', 'downloadlinkById', 'navigation', 'partsById', 'replacingFiles',
      'searchDocs', 'suggestions'],
    // 'POST': [''],
    'PUT': ['byHexxlerIds'],
    // 'RUN': ['download']
  });
  
  // specify messages that require NO access token
  this._setAccessTokenExcludes({
    // 'DELETE': [''],
    'GET': ['byId', 'navigation', 'partsById', 'searchDocs', 'suggestions'],
    // 'POST': [''],
    // 'PUT': [''],
    // 'RUN': ['']
  });
  
  return this;
};
mujs.resources.Documents.prototype = Object.create(mujs.resources.BaseResource.prototype);

/**
 *  The 'Hexxler' resource handler class to manage hexxler documents.
 *  @constructor
 *
 *  @param {Object} client The api client.
 *  @returns {Object} The 'Hexxler' object for chaining.
 */
mujs.resources.Hexxler = function(client) {
  mujs.resources.BaseResource.call(this, 'hexxler', client, '1.0.0');
  
  // generate resource methods and specifier
  this._generateResourceMethods({
    // 'DELETE': [''],
    'GET': ['document', 'completeMindItemById'],
    // 'POST': [''],
    'PUT': ['byMindItemId'],
    // 'RUN': ['']
  });
  
  // specify messages that require NO access token
  this._setAccessTokenExcludes({
    // 'DELETE': [''],
    // 'GET': [''],
    // 'POST': [''],
    // 'PUT': [''],
    // 'RUN': ['']
  });
  
  return this;
};
mujs.resources.Hexxler.prototype = Object.create(mujs.resources.BaseResource.prototype);

/**
 *  The 'Landingpage' resource handler class to access the all billing related informations.
 *  @constructor
 *
 *  @param {Object} client The api client.
 *  @returns {Object} The 'Landingpage' object for chaining.
 */
mujs.resources.Landingpage = function(client) {
  mujs.resources.BaseResource.call(this, 'landingpage', client, '1.0.0');
  
  // generate resource methods and specifier
  this._generateResourceMethods({
    'DELETE': [''],
    'GET': ['users', 'posts','post'],
    'POST': ['page'],
    'PUT': [''],
    // 'RUN': ['']
  });
  
  return this;
};
mujs.resources.Landingpage.prototype = Object.create(mujs.resources.BaseResource.prototype);

/**
 *  The 'Links' resource handler class to access and manipulate the users links.
 *  @constructor
 *
 *  @param {Object} client The api client.
 *  @returns {Object} The 'Links' object for chaining.
 */
mujs.resources.Links = function(client) {
  mujs.resources.BaseResource.call(this, 'links', client, '1.0.0');
  
  // generate resource methods and specifier
  this._generateResourceMethods({
    'DELETE': ['byId', 'byIdList'],
    'GET': ['byId', 'byIdList', 'byUserId', 'dleditor', 'dlupload'],
    'POST': ['copy', 'one'],
    'PUT': ['editor', 'group', 'note', 'position', 'size']
  });
  
  return this;
};
mujs.resources.Links.prototype = Object.create(mujs.resources.BaseResource.prototype);

/**
 *  The 'Mails' resource handler class to access the mail system.
 *  @constructor
 *
 *  @param {Object} client The api client.
 *  @returns {Object} The 'Mails' object for chaining.
 */
mujs.resources.Mails = function(client) {
  mujs.resources.BaseResource.call(this, 'mails', client, '1.0.0');
  
  // generate resource methods and specifier
  this._generateResourceMethods({
    'DELETE': ['optOut'],
    // 'GET': [''],
    'POST': ['optIn', 'optInByName'],
    'PUT': ['password'],
    // 'RUN': ['']
  });
  
  // specify messages that require NO access token
  this._setAccessTokenExcludes({
    // 'DELETE': [''],
    // 'GET': [''],
    // 'POST': [''],
    'PUT': ['password'],
    // 'RUN': ['']
  });
  
  return this;
};
mujs.resources.Mails.prototype = Object.create(mujs.resources.BaseResource.prototype);

/**
 *  The 'playlist' resource handler class to access the playlists.
 *  @constructor
 *
 *  @param {Object} client The api client.
 *  @returns {Object} The 'Playlists' object for chaining.
 */
mujs.resources.Playlists = function(client) {
  mujs.resources.BaseResource.call(this, 'playlists', client, '1.0.0');
  
  // generate resource methods and specifier
  this._generateResourceMethods({
    // 'DELETE': [''],
    'GET': ['all', 'byClient'],
    'POST': ['one'],
    'PUT': ['list'],
    // 'RUN': ['']
  });
  
  // specify messages that require NO access token
  this._setAccessTokenExcludes({
    // 'DELETE': [''],
    // 'GET': [''],
    // 'POST': [''],
    // 'PUT': [''],
    // 'RUN': ['']
  });
  
  return this;
};
mujs.resources.Playlists.prototype = Object.create(mujs.resources.BaseResource.prototype);

/**
 *  The 'Replaceimages' resource handler class to upload replacement images for sepcific document pages.
 *  @constructor
 *
 *  @param {Object} client The api client.
 *  @returns {Object} The 'Replaceimages' object for chaining.
 */
mujs.resources.Replaceimages = function(client) {
  mujs.resources.BaseResource.call(this, 'replaceimages', client, '1.0.0');
  
  // generate resource methods and specifier
  this._generateResourceMethods({
    // 'DELETE': [''],
    // 'GET': [''],
    'POST': ['one'],
    // 'PUT': [''],
    // 'RUN': ['']
  });
  
  // specify messages that require NO access token
  this._setAccessTokenExcludes({
    // 'DELETE': [''],
    // 'GET': [''],
    // 'POST': [''],
    // 'PUT': [''],
    // 'RUN': ['']
  });
  
  return this;
};
mujs.resources.Replaceimages.prototype = Object.create(mujs.resources.BaseResource.prototype);

/**
 *  The 'ReportDocuments' resource handler class to access and manipulate reported documents.
 *  @constructor
 *
 *  @param {Object} client The api client.
 *  @returns {Object} The 'ReportDocuments' object for chaining.
 */
mujs.resources.ReportDocuments = function(client) {
  mujs.resources.BaseResource.call(this, 'reportDocuments', client, '1.0.0');
  
  // generate resource methods and specifier
  this._generateResourceMethods({
    // 'DELETE': [''],
    'GET': ['byId', 'byIdList', 'open'],
    'POST': ['one'],
    'PUT': ['byId'],
    // 'RUN': ['']
  });
  
  return this;
};
mujs.resources.ReportDocuments.prototype = Object.create(mujs.resources.BaseResource.prototype);

/**
 *  The 'Templates' resource handler class to access the templates for client side rendering.
 *  @constructor
 *
 *  @param {Object} client The api client.
 *  @returns {Object} The 'Templates' object for chaining.
 */
mujs.resources.Templates = function(client) {
  mujs.resources.BaseResource.call(this, 'templates', client, '1.0.0');
  
  // generate resource methods and specifier
  this._generateResourceMethods({
    // 'DELETE': [''],
    'GET': ['byPathList'],
    // 'POST': [''],
    // 'PUT': [''],
    // 'RUN': ['']
  });
  
  // specify messages that require NO access token
  this._setAccessTokenExcludes({
    // 'DELETE': [''],
    'GET': ['byPathList'],
    // 'POST': [''],
    // 'PUT': [''],
    // 'RUN': ['']
  });
  
  return this;
};
mujs.resources.Templates.prototype = Object.create(mujs.resources.BaseResource.prototype);

/**
 *  The 'Texts' resource handler class to access and manipulate the text/language files.
 *  @constructor
 *
 *  @param {Object} client The api client.
 *  @returns {Object} The 'Texts' object for chaining.
 */
mujs.resources.Texts = function(client) {
  mujs.resources.BaseResource.call(this, 'texts', client, '1.0.0');
  
  // generate resource methods and specifier
  this._generateResourceMethods({
    'DELETE': ['byId'],
    'GET': ['all', 'byId', 'byIdList', 'byName', 'byNameList',],
    'POST': ['one'],
    'PUT': ['data'],
    'WIPE': ['byId'],
    // 'RUN': ['']
  });
  
  // specify messages that require NO access token
  this._setAccessTokenExcludes({
    // 'DELETE': [''],
    'GET': ['byName', 'byNameList'],
    // 'POST': [''],
    // 'PUT': [''],
    // 'RUN': ['']
  });
  
  return this;
};
mujs.resources.Texts.prototype = Object.create(mujs.resources.BaseResource.prototype);

/**
 *  The 'Users' resource handler class to access and manipulate the user system.
 *  @constructor
 *
 *  @param {Object} client The api client.
 *  @returns {Object} The 'Users' object for chaining.
 */
mujs.resources.Users = function(client) {
  mujs.resources.BaseResource.call(this, 'users', client, '1.0.0');
  
  // generate resource methods and specifier
  this._generateResourceMethods({
    'DELETE': ['byEmail'],
    'GET': ['byCustomerId', 'byCustomerKdnr', 'byEmail', 'byId', 'byName', 'byOauthToken'],
    'POST': ['one'],
    'PUT': ['bonuses', 'byId', 'editorTermsOfUseAccepted', 'email', 'invoiceAddress', 'mailings',
      'materialBoxHintShown', 'maxRecommendations', 'offer', 'password', 'profile', 'recommendation', 'recoverPassword',
      'removeOauthToken', 'screenOrder', 'traineeCertificates', 'welcomeShown'],
    // 'RUN': ['']
  });
  
  // specify messages that require NO access token
  this._setAccessTokenExcludes({
    // 'DELETE': [''],
    'GET': ['byEmail'],
    // 'POST': [''],
    'PUT': ['recoverPassword'],
    // 'RUN': ['']
  });
  
  return this;
};
mujs.resources.Users.prototype = Object.create(mujs.resources.BaseResource.prototype);


/**
 *  Log in a user into the api to get an access token.
 *
 *  @param {String} username The email address of the user.
 *  @param {String} password The password of the user.
 *  @param {Boolean} storeToken Indicate if the token data should be stored in a cookie or in the local storage.
 *    (optional)
 *  @param {Function} callback The callback function that is executed when the answer is received from the server.
 */
mujs.resources.Users.prototype.login = function(username, password, storeToken, _callback) {
  var callback = arguments[arguments.length - 1];
  
  if (arguments.length === 3) {
    storeToken = true;
  }
  
  this.client._login(username, password, storeToken, callback);
};


/**
 *  Log out the current user.
 *
 *  @param {String} userId The ID of the current logged in user.
 *  @param {Function} callback The Callback function that is executed when the answer is received from the server.
 */
mujs.resources.Users.prototype.logout = function(userId, callback) {
  this.client._logout(userId, callback);
};


/**
 *  Tries to find the user with the given email address.
 *
 *  @param {String} email The email address of the user.
 *  @param {Function} callback The callback function that is executed when the answer is received from the server.
 */
mujs.resources.Users.prototype.exist = function(email, callback) {
  this.GET.byEmail({email: email}, callback);
};

/**
 *  The 'Wordpress' resource handler class to access and manipulate the wordpress system..
 *  @constructor
 *
 *  @param {Object} client The api client.
 *  @returns {Object} The 'Wordpress' object for chaining.
 */
mujs.resources.Wordpress = function(client) {
  mujs.resources.BaseResource.call(this, 'wordpress', client, '1.0.0');
  
  // generate resource methods and specifier
  // this._generateResourceMethods({
    // 'DELETE': ['byDocumentId'],
    // 'GET': ['byDocumentId'],
    // 'POST': ['one'],
    // 'PUT': ['byDocumentId']
  // });
  
  // specify messages that require NO access token
  // this._setAccessTokenExcludes({
    // 'DELETE': [''],
    // 'GET': [''],
    // 'POST': [''],
    // 'PUT': [''],
    // 'RUN': ['']
  // });
  
  return this;
};
mujs.resources.Wordpress.prototype = Object.create(mujs.resources.BaseResource.prototype);

/**
 *  The 'CookieTokenDataStore' class provides the functionality to store token data as cookie. The class uses the
 *  jQuery.cookie plugin.
 *  @constructor
 *
 *  @param {Object} options The options for the token data store.
 *  @returns {Object} The 'CookieTokenDataStore' object for chaining.
 */
mujs.stores.CookieTokenDataStore = function(options) {
  this.tokenData = null;
  this.options = options;
  
  this.cookieOptions = {
    path: '/'
  };
  if (typeof this.options.domain !== 'undefined') {
    this.cookieOptions.domain = this.options.domain;
  }
  
  this.getTokenData();
  
  return this;
};


/**
 *  Store the given token data in a cookie.
 *
 *  @param {Object} tokenData The token data that is stored in the cookie.
 *  @param {Boolean} storeToken Indicate if the given token data should be stored in a cookie.
 */
mujs.stores.CookieTokenDataStore.prototype.setTokenData = function(tokenData, storeToken) {
  if (typeof tokenData.timestamp !== 'undefined' && typeof tokenData.expires_in !== 'undefined') {
    this.cookieOptions.expires = new Date(tokenData.timestamp + (tokenData.expires_in * 1000));
  }
  
  if (typeof storeToken === 'undefined' || storeToken) {
    jQuery.cookie(this.options.keyName, JSON.stringify(tokenData), this.cookieOptions);
  }
  this.tokenData = tokenData;
};


/**
 *  Return the token data from the cookie.
 *
 *  @returns {Object} The token data.
 */
mujs.stores.CookieTokenDataStore.prototype.getTokenData = function() {
  if (this.tokenData === null) {
    var tokenDataString = jQuery.cookie(this.options.keyName);
    if (typeof tokenDataString !== 'undefined') {
      try {
        this.tokenData = JSON.parse(tokenDataString);
      } catch (e) {
        return null;
      }
    }
  }
  return this.tokenData;
};


/**
 *  Remove the token data cookie.
 */
mujs.stores.CookieTokenDataStore.prototype.removeTokenData = function() {
  jQuery.removeCookie(this.options.keyName, this.cookieOptions);
  this.tokenData = null;
};


/**
 *  Return true if the token data is stored in the cookie, false otherwise.
 *
 *  @returns {Boolean} true if the token data exists, false otherwise.
 */
mujs.stores.CookieTokenDataStore.prototype.tokenDataExists = function() {
  var tokenDataString = jQuery.cookie(this.options.keyName);
  return (typeof tokenDataString !== 'undefined');
};

/**
 *  The 'LocalStorageTokenDataStore' class provides the functionality to store the token data in the browsers local
 *  storage.
 *  @constructor
 *
 *  @param {Object} options The options for the token data store.
 *  @returns {Object} The 'LocalStorageTokenDataStore' object for chaining.
 */
mujs.stores.LocalStorageTokenDataStore = function(options) {
  this.tokenData = null;
  this.options = options;
  
  this.getTokenData();
  
  return this;
};


/**
 *  Store the given token data in the local storage.
 *
 *  @param {Object} tokenData The token data that is stored in the local storage.
 *  @param {Boolean} storeToken Indicate if the given token data should be stored in the local storage.
 */
mujs.stores.LocalStorageTokenDataStore.prototype.setTokenData = function(tokenData, storeToken) {
  if (typeof storeToken === 'undefined' || storeToken) {
    localStorage[this.options.keyName] = JSON.stringify(tokenData);
  }
  this.tokenData = tokenData;
};


/**
 *  Return the token data from the local storage.
 *
 *  @returns {Object} The token data.
 */
mujs.stores.LocalStorageTokenDataStore.prototype.getTokenData = function() {
  if (this.tokenData === null) {
    if (typeof localStorage[this.options.keyName] !== 'undefined') {
      this.tokenData = JSON.parse(localStorage[this.options.keyName]);
    }
  }
  return this.tokenData;
};


/**
 *  Remove the token data from the local storage.
 */
mujs.stores.LocalStorageTokenDataStore.prototype.removeTokenData = function() {
  localStorage.removeItem(this.options.keyName);
  this.tokenData = null;
};


/**
 *  Return true if the token data is stored in the local storage, false otherwise.
 *
 *  @returns {Boolean} true if the token data exists, false otherwise.
 */
mujs.stores.LocalStorageTokenDataStore.prototype.tokenDataExists = function() {
  return (typeof localStorage[this.options.keyName] !== 'undefined');
};

/**
 *  The 'BaseTransport' is the base class for the other transport method and inherits event emitting.
 *  @constructor
 *
 *  @param {Object} options The config for the transport.
 *  @param {Object} logger A logger instance.
 *  @returns {Object} The 'BaseTransport' object for chaining.
 */
mujs.transports.BaseTransport = function(options, logger) {
  mujs.utils.EventEmitter.call(this, ['online', 'offline', 'error', 'pushMessage']);
  
  this.options = options;
  this.logger = logger;
  
  return this;
};
mujs.transports.BaseTransport.prototype = Object.create(mujs.utils.EventEmitter.prototype);

/**
 *  The 'HttpTransport' class provides the functionality to send messages over http/https with jQuery.ajax to the API.
 *  Event emitting, etc. are inherited from the 'BaseTransport'.
 *  @constructor
 *
 *  @param {Object} options The config for the transport.
 *  @param {Object} logger A logger instance.
 *  @returns {Object} The 'HttpTransport' object for chaining.
 */
mujs.transports.HttpTransport = function(options, logger) {
  mujs.transports.BaseTransport.call(this, options, logger);
  
  return this;
};
mujs.transports.HttpTransport.prototype = Object.create(mujs.transports.BaseTransport.prototype);


/**
 *  A callback function that is executed on jquery ajax success.
 *
 *  @param {Object} data The data returned from the server.
 *  @param {String} textStatus The string that describes the status.
 *  @param {Object} jqXHR The jqXHR object which is a superset of the XMLHTTPRequest object.
 *  @param {Function} callback The callback function that is executed to return the answer.
 */
mujs.transports.HttpTransport.prototype._onMessage = function(data, textStatus, jqXHR, callback) {
  callback(data);
};


/**
 *  A callback function that is executed on ajax request error.
 *
 *  @param {Object} jqXHR The jqXHR object which is a superset of the XMLHTTPRequest object.
 *  @param {String} textStatus The string that describes the status.
 *  @param {String} errorThrown The string describes the error.
 *  @param {Function} callback The callback function that is executed to return the error.
 */
mujs.transports.HttpTransport.prototype._onError = function(jqXHR, textStatus, errorThrown, callback) {
  this.logger.error('[mujs] - http transport error', jqXHR, textStatus, errorThrown);
  this.emit('error', {jqXHR: jqXHR, textStatus: textStatus, errorThrown: errorThrown});
};


/**
 *  Send a given message over http/https to the server using 'jQuery.ajax'.
 *
 *  @param {Object} msg The message object.
 *  @param {String} accessToken The access token for the request.
 *  @param {Function} callback A callback function that is executed when the server sends an answer.
 */
mujs.transports.HttpTransport.prototype.send = function(msg, accessToken, callback) {
  // adding the client id to the message data
  msg.data.clientId = this.options.clientId;
  
  var headers = {};
  if (accessToken !== '') {
    headers.authorization = 'Authorization: Bearer ' + accessToken;
  }
  
  var url = this.options.protocol + '://' + this.options.hostname + ':' + this.options.port + '/' + msg.topic;
  if (typeof msg.queryString !== 'undefined') {
    url += ('?' + msg.queryString);
  }
  
  var self = this;
  jQuery.ajax({
    contentType: 'application/json; charset=UTF-8',
    type: 'POST',
    dataType: 'json',
    url: url,
    data: JSON.stringify(msg.data),
    headers: headers,
    success: function(data, textStatus, jqXHR) {
      self._onMessage(data, textStatus, jqXHR, callback);
    },
    error: function(jqXHR, textStatus, errorThrown) {
      self._onError(jqXHR, textStatus, errorThrown, callback);
    }
  });
};


/**
 *  Activate the http transport method.
 */
mujs.transports.HttpTransport.prototype.activate = function() {
  this.emit('online', {});
};


/**
 *  Deactivate the http transport method.
 */
mujs.transports.HttpTransport.prototype.deactivate = function() {
  // TODO: network connection timeout -> save previous message to first position in the queue -> set check interval
  this.emit('offline', {});
};

/**
 *  The 'WebSocketTransport' provides the functionality to send messages over a websocket. The client uses the 'r2d2'
 *  library to interact with websockets. Event emitting, etc. are inherited from the 'BaseTransport'.
 *  @constructor
 *
 *  @param {Object} options The config for the transport.
 *  @param {Object} logger A logger instance.
 *  @returns {Object} The 'WebSocketTransport' object for chaining.
 */
mujs.transports.WebSocketTransport = function(options, logger) {
  mujs.transports.BaseTransport.call(this, options, logger);
  
  return this;
};
mujs.transports.WebSocketTransport.prototype = Object.create(mujs.transports.BaseTransport.prototype);


/**
 *  Initialize the WebSocket communication by establishing a websocket with the server and registering all callback
 *  functions.
 */
mujs.transports.WebSocketTransport.prototype._initWebSocket = function() {
  this.requestCallbacks = {};
  
  this.socketConnectionId = mujs.utils.randomString(12, true, true, true, true);
  this.socket = new Socket(
    {
      url: this.options.hostname,
      port: this.options.port,
      parameters: 'clientId=' + this.options.clientId + '&connectionId=' + this.socketConnectionId,
      protocol: this.options.protocol,
      ssl: this.options.ssl
    },
    {
      autoReconnect: true
    }
  );
  this.socket.id = this.socketConnectionId;
  
  var self = this;
  this.socket.on('open', function(e) {
    self.logger.log('[mujs] - ' + self.options.clientId + ' - socket open');
    self._onOpen(e);
  });
  
  this.socket.on('message', function(msg, e) {
    self.logger.log('[mujs] - ' + self.options.clientId + ' - socket message', msg);
    self._onMessage(msg, e);
  });
  
  this.socket.on('reconnect', function(msg, e) {
    self.logger.log('[mujs] - ' + self.options.clientId + ' - socket reconnect', msg);
    self._onReconnect(msg, e);
  });
  
  this.socket.on('close', function(e) {
    self.logger.log('[mujs] - ' + self.options.clientId + ' - socket close');
    self._onClose(e);
  });
  
  this.socket.on('error', function(e) {
    self.logger.log('[mujs] - ' + self.options.clientId + ' - socket error');
    self._onError(e);
  });
};


/**
 *  A callback function that is executed on socket open.
 *
 *  @param {Object} e The socket error object.
 */
mujs.transports.WebSocketTransport.prototype._onOpen = function(e) {
  this.emit('online', {});
};


/**
 *  A callback function that is executed on socket message.
 *
 *  @param {Object} msg The socket message.
 *  @param {Object} e The socket error object.
 */
mujs.transports.WebSocketTransport.prototype._onMessage = function(msg, e) {
  var requestId = null;
  if (typeof msg.requestId !== 'undefined') {
    requestId = msg.requestId;
  }
  
  if (requestId !== null && typeof this.requestCallbacks[requestId] === 'function') {
    var callback = this.requestCallbacks[requestId];
    delete this.requestCallbacks[requestId];
    callback(msg);
  } else if (typeof msg.type !== 'undefined' && msg.type === 'propagation') {
    this.emit('pushMessage', msg);
  } else {
    this.logger.log('[mujs] - ' + this.options.clientId + ' - no request ID found', msg);
  }
};


/**
 *  A callback function that is executed on socket reconnect.
 *
 *  @param {Object} msg The socket reconnect message.
 *  @param {Object} e The socket error object.
 */
mujs.transports.WebSocketTransport.prototype._onReconnect = function(msg, e) {
  this.emit('online', {});
};


/**
 *  A callback function that is executed on socket close.
 *
 *  @param {Object} e The socket error object.
 */
mujs.transports.WebSocketTransport.prototype._onClose = function(e) {
  this.emit('offline', {});
};


/**
 *  A callback function that is executed on socket error.
 *
 *  @param {Object} e The socket error object.
 */
mujs.transports.WebSocketTransport.prototype._onError = function(e) {
  this.logger.error('[mujs] - websocket transport error', e);
  this.emit('error', e);
};


/**
 *  Generate a unique communication ID.
 *
 *  @returns {String} A unique communication ID.
 */
mujs.transports.WebSocketTransport.prototype._generateCommunicationId = function() {
  return 'comm' + mujs.utils.randomString(12, true, true, true, true);
};


/**
 *  Check if the given string is a communication id
 *
 *  @param {Object} id The communication id.
 *  @returns {Boolean} True if the given string is a communication id. False otherwise.
 */
mujs.transports.WebSocketTransport.prototype._isCommunicationId = function(id) {
  if (typeof id !== 'string' || id.indexOf('comm') !== 0 || id.length !== 29) {
    return false;
  }
  return true;
};



/**
 *  Send a given message over the socket to the server.
 *
 *  @param {Object} msg The socket message.
 *  @param {String} accessToken The access token for the request.
 *  @param {Function} callback A callback function that is executed when the server sends an answer.
 */
mujs.transports.WebSocketTransport.prototype.send = function(msg, accessToken, callback) {
  var requestId = this._generateCommunicationId();
  this.requestCallbacks[requestId] = callback;
  
  this.logger.log('[mujs] - ' + this.options.clientId + ' - sending data with request ID: ' + requestId);
  
  var message = msg.data;
  message.clientId = this.options.clientId;
  message.topic = '/commToServer/' + mujs.utils.rtrim(msg.topic, '/') + '/' + requestId;
  
  if (typeof msg.queryString !== 'undefined') {
    message.topic += ('?' + msg.queryString);
  }
  
  if (accessToken !== '') {
    message.headers = {
      authorization: 'Authorization: Bearer ' + accessToken
    };
  }
  
  this.socket.send('bubPubSub', message);
};


/**
 *  Activate the websocket transport method.
 */
mujs.transports.WebSocketTransport.prototype.activate = function() {
  // init the WebSocket communication
  this._initWebSocket();
};


/**
 *  Deactivate the websocket transport method.
 */
mujs.transports.WebSocketTransport.prototype.deactivate = function() {
  // TODO: implement a destroy function for r2d2
  this.socket.socket.close();
  delete this.socket.handler;
};
