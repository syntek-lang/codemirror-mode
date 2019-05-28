/* global CodeMirror */

CodeMirror.defineMode('syntek', (config) => {
  const ERROR_CLASS = 'error';

  // Tokens
  const COMMENT = /^#.*/;
  const NUMBER = /^(?:0|-?[1-9]\d*(?:\.\d+)?)/;
  const STRING = /^'(?:[^'\\]|\\.)*'/;
  const OPERATORS = ['=', '+', '-', '*', '/', '%', '^'];
  const WORD_OPERATORS = ['is greater than', 'is less than', 'is not', 'is'];
  const PUNCTUATION = ['(', ')', '[', ']', '{', '}', ',', '.'];
  const KEYWORDS = [
    'class', 'static',
    'function',
    'continue', 'break', 'return',
    'while',
    'repeat', 'times',
    'for', 'in',
    'else if', 'else', 'if',
    'import', 'as',
  ];
  const BUILTINS = ['print'];
  const TYPES = ['number', 'string', 'boolean', 'object', 'any'];
  const ATOMS = ['true', 'false'];
  const THIS = 'this';
  const IDENTIFIER = /^[a-zA-Z_]\w*/;

  // Keywords that handle indentation
  const INDENT_KEYWORDS = ['if', 'else', 'else if', 'for', 'while', 'repeat', 'class', 'function'];
  const DEDENT_KEYWORDS = ['return', 'break', 'continue'];

  function pushScope(state, type) {
    state.scopes.push({
      offset: state.indent + config.tabSize,
      type,
    });
  }

  function popScope(state) {
    const offset = state.lastScope().offset;

    while (state.scopes.length > 1 && state.lastScope().offset === offset) {
      state.scopes.pop();
    }
  }

  function tokenLexer(stream, state) {
    const style = state.tokenize(stream, state);
    const current = stream.current();

    // Add an indent
    if (INDENT_KEYWORDS.includes(current)) {
      pushScope(state, 'block');
    }

    // Remove an indent
    if (DEDENT_KEYWORDS.includes(current)) {
      state.dedent += 1;
    }

    // Enter or exit array, parentheses and object scope
    if (current.length === 1 && !['string', 'comment'].includes(style)) {
      let index = '[({'.indexOf(current);
      if (index !== -1) {
        pushScope(state, '])}'[index]);
      }

      index = '])}'.indexOf(current);
      if (index !== -1) {
        if (state.findLastOfType(current)) {
          state.indent = state.findLastOfType(current).offset - config.tabSize;
          state.scopes.pop();
        } else {
          return ERROR_CLASS;
        }
      }
    }

    // Dedent where needed
    if (state.dedent > 0 && stream.eol()) {
      popScope(state);
      state.dedent -= 1;
    }

    return style;
  }

  function tokenBaseInner(stream, state) {
    if (stream.eatSpace()) {
      return null;
    }

    // Handle comments
    if (stream.match(COMMENT)) {
      return 'comment';
    }

    // Handle number literals
    if (stream.match(NUMBER)) {
      return 'number';
    }

    // Handle strings
    if (stream.match(STRING)) {
      return 'string';
    }

    // Handle operators
    for (const operator of OPERATORS) {
      if (stream.match(operator)) {
        return 'operator';
      }
    }

    // Handle punctuation
    for (const punctuation of PUNCTUATION) {
      if (stream.match(punctuation)) {
        return 'punctuation';
      }
    }

    // Handle properties
    if (state.lastToken === '.' && stream.match(IDENTIFIER)) {
      return 'property';
    }

    // Handle keywords
    for (const keyword of [...KEYWORDS, ...WORD_OPERATORS]) {
      if (stream.match(keyword)) {
        return 'keyword';
      }
    }

    // Handle builtins
    for (const builtin of BUILTINS) {
      if (stream.match(builtin)) {
        return 'builtin';
      }
    }

    // Handle types
    for (const type of TYPES) {
      if (stream.match(type)) {
        return 'type';
      }
    }

    // Handle atoms
    for (const atom of ATOMS) {
      if (stream.match(atom)) {
        return 'atom';
      }
    }

    // Handle this
    if (stream.match(THIS)) {
      return 'variable-2';
    }

    // Handle identifiers
    if (stream.match(IDENTIFIER)) {
      if (state.lastToken === 'class' || state.lastToken === 'function') {
        return 'def';
      }

      return 'variable';
    }

    // Handle unknown tokens
    stream.next();
    return ERROR_CLASS;
  }

  function tokenBase(stream, state) {
    if (stream.sol()) {
      state.indent = stream.indentation();

      if (state.lastScope().type === 'block') {
        const scopeOffset = state.lastScope().offset;

        if (stream.eatSpace()) {
          const lineOffset = stream.indentation();

          if (lineOffset > scopeOffset) {
            pushScope(state, 'block');
          } else if (lineOffset % config.tabSize !== 0 && stream.peek() !== '#') {
            state.error = true;
          }

          return null;
        }
      }
    }

    return tokenBaseInner(stream, state);
  }

  return {
    startState(basecolumn) {
      return {
        tokenize: tokenBase,

        indent: basecolumn || 0,
        dedent: 0,

        lastToken: null,
        error: false,

        scopes: [{ offset: basecolumn || 0, type: 'block' }],
        lastScope() {
          return this.scopes[this.scopes.length - 1];
        },
        findLastOfType(type) {
          return this.scopes.filter(scope => scope.type === type).pop();
        },
      };
    },

    token(stream, state) {
      const error = state.error;
      if (error) {
        state.error = false;
      }

      const style = tokenLexer(stream, state);

      if (style !== 'comment') {
        if (style === 'keyword' || style === 'punctuation') {
          state.lastToken = stream.current();
        } else {
          state.lastToken = style;
        }
      }

      return error ? `${style} ${ERROR_CLASS}` : style;
    },

    indent(state, textAfter) {
      const type = textAfter.charAt(0);

      const scope = state.findLastOfType(type) || state.lastScope();
      const closing = scope.type === type;

      return scope.offset - (closing ? config.tabSize : 0);
    },

    electricInput: /^\s*[}\])]$/,
    lineComment: '#',
    fold: 'indent',
  };
});

CodeMirror.defineMIME('text/x-syntek', 'syntek');
