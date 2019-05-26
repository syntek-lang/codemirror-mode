/* global CodeMirror */

// import CodeMirror from 'codemirror';

CodeMirror.defineMode('syntek', (config) => {
  console.log(config);

  const ERROR_CLASS = 'error';

  const COMMENT = /^#.*/;
  const NUMBER = /^(?:0|-?[1-9]\d*(?:\.\d+)?)/;
  const STRING = /^'(?:[^'\\]|\\.)*'/;
  const OPERATORS = ['=', '+', '-', '*', '/', '%', '^'];
  const WORD_OPERATORS = ['is greater than', 'is less than', 'is not', 'is'];
  const PUNCTUATION = ['(', ')', '[', ']', '{', '}', ',', '.'];
  const KEYWORDS = [
    'true', 'false',
    'class', 'static',
    'function',
    'continue', 'break', 'return',
    'while',
    'repeat', 'times',
    'for', 'in',
    'else if', 'else', 'if',
    'import', 'as',
  ];
  const BUILTINS = [
    'number', 'string', 'boolean', 'object', 'any',
    'print',
  ];
  const THIS = 'this';
  const IDENTIFIER = /^[a-zA-Z_]\w*/;

  function tokenBase(stream, state) {
    if (stream.sol()) {
      // Set the indentation level
      state.indent = stream.indentation();
    }

    return tokenBaseInner(stream, state);
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
    if (stream.sol()) {
      state.beginningOfLine = true;
    }

    return state.tokenize(stream, state);
  }

  return {
    startState(basecolumn) {
      return {
        tokenize: tokenBase,
        indent: basecolumn || 0,
        lastToken: null,
        dedent: 0,
      };
    },
    token(stream, state) {
      const style = tokenLexer(stream, state);
      // console.log(stream, state, style);

      if (style && style !== 'comment') {
        if (style === 'keyword' || style === 'punctuation') {
          state.lastToken = stream.current();
        } else {
          state.lastToken = style;
        }
      }

      return style;
    },
  };
});

CodeMirror.defineMIME('text/x-syntek', 'syntek');
