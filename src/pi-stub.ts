/**
 * Minimal pi SDK stubs used only for local tool definitions and schema typing.
 */

export const Type = {
  Object: (schema: any) => schema,
  String: (opts?: any) => ({ type: 'string', ...opts }),
  Optional: (t: any) => t,
  Number: (opts?: any) => ({ type: 'number', ...opts }),
  Boolean: (opts?: any) => ({ type: 'boolean', ...opts }),
  Array: (t: any) => ({ type: 'array', items: t }),
  Record: (k: any, v: any) => ({ type: 'object', additionalProperties: v })
};

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
  execute(context: any, args: any): Promise<{ content: Array<{ type: 'text'; text: string }> }>;
}

export function defineTool(config: {
  name: string;
  description: string;
  parameters: any;
  execute: (context: any, args: any) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;
}): ToolDefinition {
  return {
    name: config.name,
    description: config.description,
    parameters: config.parameters,
    execute: config.execute
  };
}
