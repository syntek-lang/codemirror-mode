(function umd(mod) {
  /* eslint-disable global-require, no-undef */
  if (typeof exports === 'object' && typeof module === 'object') { // CommonJS
    mod(require('codemirror/lib/codemirror.js'));
  } else if (typeof define === 'function' && define.amd) { // AMD
    define(['codemirror/lib/codemirror.js'], mod);
  } else { // Plain browser env
    mod(CodeMirror);
  }
  /* eslint-enable */
}((CodeMirror) => {
  CodeMirror.defineMode('syntek', (config) => {
    const ERROR_CLASS = 'error';

    function wordsToRegex(words) {
      return new RegExp(`^((${words.join(')|(')}))\\b`);
    }

    // Tokens
    const COMMENT = /^#.*/;
    const NUMBER = /^(?:0|-?[1-9]\d*(?:\.\d+)?)/;
    const STRING = /^'(?:[^'\\]|\\.)*'/;

    const OPERATORS = ['=', '+', '-', '*', '/', '%', '^'];
    const PUNCTUATION = ['(', ')', '[', ']', '{', '}', ',', '.'];

    const KEYWORDS = wordsToRegex([
      'class', 'static',
      'function',
      'continue', 'break', 'return',
      'while',
      'repeat', 'times',
      'for', 'in',
      'else if', 'else', 'if',
      'import', 'as',
    ]);
    const WORD_OPERATORS = wordsToRegex(['is greater than', 'is less than', 'is not', 'is']);

    const BUILTINS = wordsToRegex(['print']);
    const TYPES = wordsToRegex(['number', 'string', 'boolean', 'object', 'any']);
    const ATOMS = wordsToRegex(['true', 'false']);
    const THIS = wordsToRegex(['this']);
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
      if (stream.match(KEYWORDS) || stream.match(WORD_OPERATORS)) {
        return 'keyword';
      }

      // Handle builtins
      if (stream.match(BUILTINS)) {
        return 'builtin';
      }

      // Handle types
      if (stream.match(TYPES)) {
        return 'type';
      }

      // Handle atoms
      if (stream.match(ATOMS)) {
        return 'atom';
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
}));
