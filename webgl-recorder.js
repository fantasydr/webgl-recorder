(function() {
    
    // consts
  var GLConsts = {};
    
  var getContext = HTMLCanvasElement.prototype.getContext;
  var requestAnimationFrame = window.requestAnimationFrame;
  var frameSincePageLoad = 0;

  function countFrames() {
    frameSincePageLoad++;
    requestAnimationFrame(countFrames);
  }

  window.requestAnimationFrame = function() {
    return requestAnimationFrame.apply(window, arguments);
  };


var functions = 
`
function createimg(src) {
    var img = document.createElement('img');
    img.src = src;
    document.body.appendChild(img);
    return img;
}
function createcanvas(width, height) {
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}
`;
    
  HTMLCanvasElement.prototype.getContext = function(type) {
    var canvas = this;
    var context = getContext.apply(canvas, arguments);
    
    if (type === 'webgl' || type === 'experimental-webgl') {
      var oldWidth = canvas.width;
      var oldHeight = canvas.height;
      var oldFrameCount = frameSincePageLoad;
      var trace = [];
      var variables = {};
      var exts = [];
      var fakeContext = {
        trace: trace,
        compileTrace: compileTrace,
        downloadTrace: downloadTrace,
      };

      trace.push('  gl.canvas.width = ' + oldWidth + ';');
      trace.push('  gl.canvas.height = ' + oldHeight + ';');

      function compileTrace() {
        var text = functions + 'function* render(gl) {\n';
        text += '  // Recorded using https://github.com/evanw/webgl-recorder\n';
        if(exts.length > 0) {
            text += "  GLExt = {};\n";
            for (var i in exts) {
                var extname = exts[i];
                text += '  GLExt["' + extname + '"]= gl.getExtension("' + extname+ '");\n';
            }
        }
        
        for (var key in variables) {
          if(key === "HTMLImageElement") {
              text += '  var ' + key + 's = [\n';
              var entries = variables[key];
              //var local = window.location.href.substring(0, window.location.href.lastIndexOf('/')) + "/";
              var local = location.protocol + '//' + location.host;
              
              for(var i=0;i<entries.length;i++) {
                text += '  createimg("' + entries[i].src.replace(local, "") + '"),\n';
              }
              text += "  ];\n";
          } else if(key === "HTMLCanvasElement") {
                text += '  var ' + key + 's = [\n';
                var entries = variables[key];
                for(var i=0;i<entries.length;i++) {
                    text += '  createcanvas(' + entries[i].width +"," + entries[i].height + '),\n';
                }
                text += "  ];\n";
          } else if(key === "ArrayBuffer") {
              text += '  var ' + key + 's = [\n';
              var entries = variables[key];
              for(var i=0;i<entries.length;i++)
              {
                  text += '    // Uint8Array([' + Array.prototype.slice.call(new Uint8Array(entries[i])) + ']).buffer, \n';
                  text += '    // Uint16Array([' + Array.prototype.slice.call(new Uint16Array(entries[i])) + ']).buffer, \n';
                  text += '    // Float32Array([' + Array.prototype.slice.call(new Float32Array(entries[i])) + ']).buffer, \n';
                  text += '    new Uint32Array([' + Array.prototype.slice.call(new Uint32Array(entries[i])) + ']).buffer, \n';
              }
              text += "  ];\n";
          } else if(key === "Array") {
              text += '  var ' + key + 's = JSON.parse("' + JSON.stringify(variables[key]) + '");\n';
          } else {
              text += '  var ' + key + 's = [];\n';
          }
        }
        text += trace.join('\n');
        text += '\n}\n';
        return text;
      }

      function downloadTrace() {
        var text = compileTrace();
        var link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([text], {type: 'application/javascript'}));
        link.download = 'trace.js';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      function getVariable(value) {
        if (value === null || value === undefined )
            return value;
          
          if (value instanceof WebGLActiveInfo ||
            value instanceof WebGLBuffer ||
            value instanceof WebGLFramebuffer ||
            value instanceof WebGLProgram ||
            value instanceof WebGLRenderbuffer ||
            value instanceof WebGLShader ||
            value instanceof WebGLShaderPrecisionFormat ||
            value instanceof WebGLTexture ||
            value instanceof WebGLUniformLocation ||
            value instanceof ArrayBuffer ||
            value instanceof HTMLImageElement ||
            value instanceof HTMLCanvasElement || 
            value instanceof Array ||
            value.constructor.name === "WebGLVertexArrayObjectOES" ) {
          var name = value.constructor.name;
          var list = variables[name] || (variables[name] = []);
          var index = list.indexOf(value);

          if (index === -1) {
            index = list.length;
            list.push(value);
          }

          return name + 's[' + index + ']';
        }

        //if(value) console.log("New:"+ value.constructor.name);
        return null;
      }

      function getArgs(origins)
      {
          var args = [];
          for (var i = 0; i < origins.length; i++) {
              var arg = origins[i];

              if (arg === undefined) {
                  args.push("undefined");
              }  else if (typeof arg === 'number') {
                  let info = JSON.stringify(arg);
                  let desc = GLConsts[arg];
                  if(desc) {
                      info += "/* " + desc.name + "," + desc.idstr + " */";
                  }
                  args.push(info);
              } else if (typeof arg === 'boolean' || typeof arg === 'string' || arg === null) {
                  args.push(JSON.stringify(arg));
              }

              else if (ArrayBuffer.isView(arg)) {
                  args.push('new ' + arg.constructor.name + '([' + Array.prototype.slice.call(arg) + '])');
              }

              else {
                  var variable = getVariable(arg);
                  if (variable !== null) {
                      args.push(variable);
                  }

                  else {
                      console.warn('unsupported value:', arg);
                      args.push('null');
                  }
              }
          }
          return args;
      }
      
      for (var key in context) {
        var value = context[key];

        if (typeof value === 'function') {
          fakeContext[key] = function(key, value) {
            if(key === "getExtension") {
              return function() {
                  var result = value.apply(context, arguments);
                  if(result == null)
                    return null;
                  
                  var extfake = {};
                  var extname = arguments[0];
                  if(exts.indexOf(extname)<0) exts.push(extname);
                  
                  for(var extkey in result) {
                    var extvalue = result[extkey];
                    if(typeof extvalue === 'function') {
                        extfake[extkey] = function(extkey, extvalue) {
                          return function() {
                              //////////////////////////
                              var extresult = extvalue.apply(result, arguments);
                              var extargs = getArgs(arguments);
                              var text = 'GLExt["' + extname + '"].' + extkey + '(' + extargs.join(', ') + ');';
                              var variable = getVariable(extresult);
                              if (variable !== null && variable !== undefined) text = variable + ' = ' + text;
                              trace.push('  ' + text);

                              return extresult;
                          };
                        }(extkey, extvalue);
                    } else {
                        extfake[extkey] = extvalue;
                    } // not function

                  }
                  return extfake;
              }
            }
            
            return function() {
              var result = value.apply(context, arguments);

              if (frameSincePageLoad !== oldFrameCount) {
                oldFrameCount = frameSincePageLoad;
                trace.push('  yield;');
              }

              if (canvas.width !== oldWidth || canvas.height !== oldHeight) {
                oldWidth = canvas.width;
                oldHeight = canvas.height;
                trace.push('  gl.canvas.width = ' + oldWidth + ';');
                trace.push('  gl.canvas.height = ' + oldHeight + ';');
              }
              
              var args = getArgs(arguments);  
              var text = 'gl.' + key + '(' + args.join(', ') + ');';
              var variable = getVariable(result);
              if (variable !== null && variable !== undefined) text = variable + ' = ' + text;
              trace.push('  ' + text);

              return result;
            };
          }(key, value);
        } 

        else {
          if (typeof value === 'number') {
              GLConsts[value] = {
                  name: key,
                  idstr: "0x" + value.toString(16).toUpperCase(),
              };
          }
          fakeContext[key] = value;
        }
      }

      window.curGL = fakeContext;
      return fakeContext;
    }

    return context;
  };

  countFrames();
})();
