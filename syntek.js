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

  function findStyle(stream, state) {
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

  function tokenLexer(stream, state) {
    const style = state.tokenize(stream, state);
    const current = stream.current();

    if (INDENT_KEYWORDS.includes(current)) {
      state.pushScope('block');
    }

    if (DEDENT_KEYWORDS.includes(current)) {
      state.popScope();
    }

    if (current === '{') {
      state.pushScope('}');
    }

    if (current === '}') {
      state.popScope();
    }

    return style;
  }

  function tokenBase(stream, state) {
    if (stream.sol()) {
      const topScope = state.topScope();

      if (topScope.type === 'block' && topScope.offset > 0) {
        state.dedent(stream);
      }
    }

    return findStyle(stream, state);
  }

  return {
    startState(basecolumn) {
      return {
        tokenize: tokenBase,

        lastToken: null,
        error: false,

        scopes: [{ offset: basecolumn || 0, type: 'block' }],
        topScope() {
          return this.scopes[this.scopes.length - 1];
        },
        pushScope(type) {
          return this.scopes.push({ offset: this.topScope().offset + config.tabSize, type });
        },
        popScope() {
          if (this.scopes.length > 1) {
            return this.scopes.pop();
          }

          return null;
        },
        dedent(stream) {
          const indent = stream.indentation();

          while (this.scopes.length > 1 && this.topScope().offset > indent) {
            if (this.topScope().type === 'block') {
              this.popScope();
            } else {
              return;
            }
          }
        },
        topScopeOfType(type) {
          for (let i = this.scopes.length - 1; i >= 0; i -= 1) {
            if (this.scopes[i].type === type) {
              return this.scopes[i];
            }
          }

          return null;
        },
      };
    },

    token(stream, state) {
      const error = state.error;
      if (error) {
        state.error = false;
      }

      const style = tokenLexer(stream, state);

      if (style && style !== 'comment') {
        if (style === 'keyword' || style === 'punctuation') {
          state.lastToken = stream.current();
        } else {
          state.lastToken = style;
        }
      }

      return error ? `${style} ${ERROR_CLASS}` : style;
    },

    indent(state, textAfter) {
      const scope = state.topScopeOfType(textAfter) || state.topScope();
      const closing = scope.type === textAfter;

      return scope.offset - (closing ? config.tabSize : 0);
    },

    electricInput: /^\s*[}\])]$/,
    lineComment: '#',
    fold: 'indent',
  };
});

CodeMirror.defineMIME('text/x-syntek', 'syntek');
