import { parse } from 'json-source-map';
import type { ErrorObject } from 'ajv';
import type { SchemaValidationServiceResponse } from '../services/SchemaValidationService';

export class JsonHighlighter {
  static highlight(jsonString: string, ajvResult?: SchemaValidationServiceResponse): string {
    let parsed;
    try {
      parsed = parse(jsonString);
    } catch (err: any) {
      return this.renderTable(
        jsonString,
        [],
        [`Invalid JSON: ${err?.message ?? String(err)}`]
      );
    }

    const { pointers } = parsed;
    const lines = jsonString.split(/\r?\n/);
    const lineData = lines.map(() => ({ errors: [] as string[] }));

    const errors = ajvResult?.result?.errors ?? [];
    if (!errors.length) {
      return this.renderTable(jsonString, lineData);
    }

    for (const error of errors) {
      const instancePath = error.instancePath ?? '';
      const pointer = pointers[instancePath];
      
      if (pointer) {
        const startLine = pointer.value?.line ?? pointer.key?.line ?? 0;
        const endLine   = pointer.valueEnd?.line ?? pointer.keyEnd?.line ?? startLine;
        
        for (let i = startLine; i <= endLine; i++) {
          lineData[i].errors.push(error.message || 'Validation error');
        }
      } else {
        lineData[0].errors.push(error.message || 'Validation error (no pointer info)');
      }
    }

    return this.renderTable(jsonString, lineData);
  }

  private static renderTable(
    jsonString: string,
    lineData: { errors: string[] }[],
    globalErrors: string[] = []
  ): string {
    const lines = jsonString.split(/\r?\n/);

    let html = `
<div class="overflow-x-auto border border-slate-200 dark:border-slate-700 
            rounded-lg bg-white dark:bg-slate-900 
            text-slate-800 dark:text-slate-200 p-2 
            font-mono text-sm leading-tight">
`;
    for (const errMsg of globalErrors) {
      html += `
  <div class="mb-2 text-red-600 dark:text-red-400 font-semibold">
    ${escapeHtml(errMsg)}
  </div>`;
    }

    html += `
  <table class="table-auto w-full border-collapse">
    <tbody>
`;

    lines.forEach((line, idx) => {
      const lineNumber = idx + 1;
      const isEven = lineNumber % 2 === 0;

      const hasErrors = lineData[idx].errors.length > 0;
      let rowClasses = '';
      let rowTitle = '';

      if (hasErrors) {
        rowClasses = 'bg-red-600 text-white';
        const combined = lineData[idx].errors.join(' | ');
        rowTitle = `title="${escapeHtml(combined)}"`;
      } else {
        rowClasses = isEven
          ? 'bg-slate-50 dark:bg-slate-800'
          : 'bg-white dark:bg-slate-900';
      }

      html += `
      <tr class="${rowClasses}" ${rowTitle}>
        <!-- Line Number -->
        <td class="py-1 pr-3 text-right align-top select-none opacity-70 w-10">
          ${lineNumber}
        </td>
        <!-- Actual JSON text in a <pre> to preserve indentation -->
        <td class="py-1 w-full align-top">
          <pre class="whitespace-pre m-0">${escapeHtml(line)}</pre>
        </td>
      </tr>
`;
    });

    html += `
    </tbody>
  </table>
</div>`;

    return html;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
