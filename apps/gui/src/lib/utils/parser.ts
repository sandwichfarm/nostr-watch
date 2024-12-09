export interface Parser {
    matchRegex: RegExp;
    processSync?(match: string): string;
    processAsync?(match: string): Promise<string>;
  }

  
export class AsyncParserManager {
    private parsers: Parser[] = [];

    public registerParser(parser: Parser) {
        this.parsers.push(parser);
    }

    public async parse(input: string): Promise<string> {
        let content = input;

        for (const parser of this.parsers) {
        if (parser.processSync) {
            content = content.replace(parser.matchRegex, (match) => parser.processSync!(match));
        }
        }

        const asyncTasks: Array<Promise<{ start: number; end: number; replacement: string }>> = [];

        for (const parser of this.parsers) {
        if (!parser.processAsync) continue;
        const regex = new RegExp(parser.matchRegex, parser.matchRegex.flags.includes('g') ? parser.matchRegex.flags : parser.matchRegex.flags + 'g');

        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
            const startIndex = match.index!;
            const endIndex = startIndex + match[0].length;
            const originalMatch = match[0];

            asyncTasks.push(
            parser.processAsync(originalMatch).then((replacement) => {
                return { start: startIndex, end: endIndex, replacement };
            })
            );
        }
        }

        if (asyncTasks.length === 0) {
            return content;
        }

        const results = await Promise.all(asyncTasks);

        results.sort((a, b) => b.start - a.start);

        let finalContent = content;
        for (const { start, end, replacement } of results) {
            finalContent = finalContent.slice(0, start) + replacement + finalContent.slice(end);
        }

        return finalContent;
    }
}
