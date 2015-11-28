'use strict'

var fs = require('fs');
var esprima = require('esprima');
var estraverse = require('estraverse');

var sprintf = require("sprintf-js").sprintf;

function Logger() {
  this.infoEnabled = true;
  this.verboseEnabled = false;
  this.errorEnabled = true;
}
Logger.prototype.log = function(messageParts, disableAutomaticNewLine) {
  // cannot call join in messageParts because it could be a array-like objects without a join method.
  // https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Functions/arguments
  // recomends iterating through the array and manually joining
  var msg = '';
  for (var i = 0; i<messageParts.length; ++i) {
    msg += messageParts[i] + ' ';
  }
  if (!disableAutomaticNewLine) {
    msg += '\n';
  }
  process.stdout.write(msg);
}
Logger.prototype.info = function() {
  if (this.infoEnabled) {
    this.log(arguments);
  }
}
Logger.prototype.infoNoNL = function() {
  if (this.infoEnabled) {
    this.log(arguments, true);
  }
}
Logger.prototype.verbose = function() {
  if (this.verboseEnabled) {
    this.log(arguments);
  }
}
Logger.prototype.error = function() {
  if (this.errorEnabled) {
    this.log(arguments);
  }
}

var log = new Logger();

function output() {
  var msg = '';
  for(var i = 0; i < arguments.length; ++i) {
      msg += arguments[i] + ' ';
  }
  console.log(msg);
}

function fmtSize(size) {
  if (size < 1024) {
    return size + 'B'
  } else if (size < 1024*1024) {
    return (size/1024).toFixed(2) + 'KB';
  } else if (size < 1024*1024*1024) {
    return (size/(1024*1024)).toFixed(2) + 'MB';
  } else {
    return (szie/(1024*1024*1024)).toFixed(2) + 'GB';
  }
}

function main(args) {
  var inputFileName = args[0];

  var script = '';
  try {
    script = fs.readFileSync(inputFileName).toString();
  } catch (e) {
    log.error('cannot read ', inputFileName, '\n\t', e.toString());
    return 1;
  }

  log.infoNoNL('Parsing ... ');
  var ast = esprima.parse(script, {range: true, loc: true});
  log.info('Done');

  log.verbose('Traversing');
  var Syntax = estraverse.Syntax;
  var path = [];
  var funcs = [];
  estraverse.traverse(ast, {
    enter: function(node) {
      // output(node.type);
      if (node.type == Syntax.FunctionDeclaration || node.type == Syntax.FunctionExpression) {
        var fname = node.id ? node.id.name : ('(anonymous@' + node.loc.start.line + ':' + node.loc.start.column + ')');
        var fsize = node.range[1] - node.range[0];
        path.push(fname);
        var fullname = path.join('::');
        log.verbose('Found function', fullname, 'at', node.loc.start.line, ':', node.loc.start.column, 'size', fsize);

        // anotate node and save
        node.fsize = fsize;
        node.fullname = fullname;
        funcs.push(node);
      }
    },
    leave: function(node) {
      if (node.type == Syntax.FunctionDeclaration || node.type == Syntax.FunctionExpression) {
        path.pop();
      }
    }
  });

  log.verbose("Sorting");
  funcs.sort(function (a, b) { return b.fsize - a.fsize; });
  var fmt = '%-10s %s';
  console.log(sprintf(fmt, 'Size', 'Function'));
  for (var i = 0; i<funcs.length; i++) {
    var func = funcs[i];
    output(sprintf(fmt, fmtSize(func.fsize), func.fullname));
  }
}

main(process.argv.slice(2));
