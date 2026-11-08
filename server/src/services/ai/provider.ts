export interface GenerateOptions {
  system: string;
  user: string;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generate(options: GenerateOptions): Promise<string>;
}
