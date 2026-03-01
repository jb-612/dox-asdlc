// ---------------------------------------------------------------------------
// Sandboxed expression evaluator for workflow conditions (P15-F15)
//
// Supports: ==, !=, <, >, <=, >=, &&, ||, !, literals, variable refs,
// and single-level property access (e.g. items.length).
// Denies: __proto__, constructor, prototype, function calls, assignment.
// No eval(), no new Function().
// ---------------------------------------------------------------------------

const DENIED_PROPERTIES = new Set(['__proto__', 'constructor', 'prototype']);

type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'identifier'; value: string }
  | { type: 'dot' }
  | { type: 'operator'; value: string }
  | { type: 'not' }
  | { type: 'lparen' }
  | { type: 'rparen' };

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    // Whitespace
    if (/\s/.test(ch)) { i++; continue; }

    // Two-char operators
    const twoChar = expr.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(twoChar)) {
      tokens.push({ type: 'operator', value: twoChar });
      i += 2;
      continue;
    }

    // Assignment check (single = without preceding ! or =)
    if (ch === '=' && expr[i + 1] !== '=') {
      throw new Error('Assignment not allowed in expressions');
    }

    // Single-char operators
    if (ch === '<' || ch === '>') {
      tokens.push({ type: 'operator', value: ch });
      i++;
      continue;
    }

    if (ch === '!') {
      tokens.push({ type: 'not' });
      i++;
      continue;
    }

    if (ch === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
    if (ch === '.') { tokens.push({ type: 'dot' }); i++; continue; }

    // String literals
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let str = '';
      i++;
      while (i < expr.length && expr[i] !== quote) {
        str += expr[i];
        i++;
      }
      if (i >= expr.length) throw new Error('Unterminated string literal');
      i++; // skip closing quote
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // Numbers
    if (/\d/.test(ch)) {
      let num = '';
      while (i < expr.length && /[\d.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: 'number', value: Number(num) });
      continue;
    }

    // Identifiers and boolean literals
    if (/[a-zA-Z_$]/.test(ch)) {
      let ident = '';
      while (i < expr.length && /[a-zA-Z0-9_$]/.test(expr[i])) {
        ident += expr[i];
        i++;
      }
      if (ident === 'true') {
        tokens.push({ type: 'boolean', value: true });
      } else if (ident === 'false') {
        tokens.push({ type: 'boolean', value: false });
      } else {
        tokens.push({ type: 'identifier', value: ident });
      }
      continue;
    }

    throw new Error(`Unexpected character: ${ch}`);
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Parser + evaluator (recursive descent)
// ---------------------------------------------------------------------------

class ExpressionParser {
  private tokens: Token[];
  private pos: number;
  private variables: Record<string, unknown>;

  constructor(tokens: Token[], variables: Record<string, unknown>) {
    this.tokens = tokens;
    this.pos = 0;
    this.variables = variables;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  parse(): unknown {
    const result = this.parseOr();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token at position ${this.pos}`);
    }
    return result;
  }

  // OR: expr || expr
  private parseOr(): unknown {
    let left = this.parseAnd();
    while (this.peek()?.type === 'operator' && this.peek()?.value === '||') {
      this.consume();
      const right = this.parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  // AND: expr && expr
  private parseAnd(): unknown {
    let left = this.parseComparison();
    while (this.peek()?.type === 'operator' && this.peek()?.value === '&&') {
      this.consume();
      const right = this.parseComparison();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  // Comparison: expr (==|!=|<|>|<=|>=) expr
  private parseComparison(): unknown {
    let left = this.parseUnary();
    const t = this.peek();
    if (t?.type === 'operator' && ['==', '!=', '<', '>', '<=', '>='].includes(t.value as string)) {
      const op = this.consume().value as string;
      const right = this.parseUnary();
      switch (op) {
        case '==': return left === right;
        case '!=': return left !== right;
        case '<': return (left as number) < (right as number);
        case '>': return (left as number) > (right as number);
        case '<=': return (left as number) <= (right as number);
        case '>=': return (left as number) >= (right as number);
      }
    }
    return left;
  }

  // Unary: !expr | primary
  private parseUnary(): unknown {
    if (this.peek()?.type === 'not') {
      this.consume();
      return !this.parseUnary();
    }
    return this.parsePrimary();
  }

  // Primary: literal | variable(.prop)? | (expr)
  private parsePrimary(): unknown {
    const t = this.peek();

    if (!t) throw new Error('Unexpected end of expression');

    if (t.type === 'number') { this.consume(); return t.value; }
    if (t.type === 'string') { this.consume(); return t.value; }
    if (t.type === 'boolean') { this.consume(); return t.value; }

    if (t.type === 'lparen') {
      this.consume();
      const result = this.parseOr();
      const closing = this.peek();
      if (!closing || closing.type !== 'rparen') {
        throw new Error('Expected closing parenthesis');
      }
      this.consume();
      return result;
    }

    if (t.type === 'identifier') {
      this.consume();
      let value: unknown = this.variables[t.value];

      // Single-level property access
      if (this.peek()?.type === 'dot') {
        this.consume(); // skip dot
        const propToken = this.peek();
        if (!propToken || propToken.type !== 'identifier') {
          throw new Error('Expected property name after dot');
        }
        this.consume();

        // Check for function call syntax
        if (this.peek()?.type === 'lparen') {
          throw new Error('Function calls not allowed in expressions');
        }

        const propName = propToken.value;
        if (DENIED_PROPERTIES.has(propName)) {
          throw new Error(`Access to '${propName}' is not allowed`);
        }

        if (value != null && typeof value === 'object') {
          value = (value as Record<string, unknown>)[propName];
        } else {
          value = undefined;
        }
      }

      // Check for function call on bare identifier
      if (this.peek()?.type === 'lparen') {
        throw new Error('Function calls not allowed in expressions');
      }

      return value ?? false;
    }

    throw new Error(`Unexpected token: ${JSON.stringify(t)}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a sandboxed boolean expression against workflow variables.
 * Returns the truthy/falsy result as a boolean. CC=2
 */
export function evaluateExpression(
  expr: string,
  variables: Record<string, unknown>,
): boolean {
  if (!expr || expr.trim().length === 0) {
    throw new Error('Expression cannot be empty');
  }

  const tokens = tokenize(expr.trim());
  const parser = new ExpressionParser(tokens, variables);
  const result = parser.parse();
  return Boolean(result);
}
