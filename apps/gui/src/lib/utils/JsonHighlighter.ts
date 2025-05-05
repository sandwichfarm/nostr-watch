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
        [], // No global warnings initially
        [`Invalid JSON: ${err?.message ?? String(err)}`]
      );
    }

    const { pointers } = parsed;
    const lines = jsonString.split(/\r?\n/);
    const lineData = lines.map(() => ({ errors: [] as string[], warnings: [] as string[] }));

    const errors = ajvResult?.result?.errors ?? [];
    const warnings = ajvResult?.result?.warnings ?? [];
    
    if (!errors.length && !warnings.length) {
      return this.renderTable(jsonString, lineData);
    }

    const additionalPropNames: string[] = [];

    // Process errors
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

    // Process warnings - collect additional properties and highlight lines
    for (const warning of warnings) {
      if (warning.keyword === 'additionalProperties' && warning.params?.additionalProperty) {
        const propName = warning.params.additionalProperty;
        additionalPropNames.push(propName); // Collect names for the banner
        const propFound = this.findLineWithProperty(lines, propName);
        
        if (propFound !== -1) {
          lineData[propFound].warnings.push(warning.message || `Additional property "${propName}"`);
        } else {
          // Fallback if property line not found (less likely but possible)
          const instancePath = warning.instancePath ?? '';
          const pointer = pointers[instancePath];
          if (pointer) {
            const line = pointer.value?.line ?? pointer.key?.line ?? 0;
            lineData[line].warnings.push(warning.message || `Additional property "${propName}"`);
          } else {
            lineData[0].warnings.push(warning.message || 'Schema warning (no pointer info)');
          }
        }
      } else {
        // Standard handling for other warnings (if any in the future)
        const instancePath = warning.instancePath ?? '';
        const pointer = pointers[instancePath];
        if (pointer) {
          const startLine = pointer.value?.line ?? pointer.key?.line ?? 0;
          const endLine   = pointer.valueEnd?.line ?? pointer.keyEnd?.line ?? startLine;
          for (let i = startLine; i <= endLine; i++) {
            lineData[i].warnings.push(warning.message || 'Schema warning');
          }
        } else {
          lineData[0].warnings.push(warning.message || 'Schema warning (no pointer info)');
        }
      }
    }

    // Format the global warning message for additional properties
    const globalWarningMessage = this.formatAdditionalPropertiesMessage(additionalPropNames);
    const globalWarnings = globalWarningMessage ? [globalWarningMessage] : [];

    return this.renderTable(jsonString, lineData, globalWarnings, errors.length ? [] : undefined); // Pass global warnings
  }

  // Helper to format the list of additional properties
  private static formatAdditionalPropertiesMessage(propNames: string[]): string | null {
    if (propNames.length === 0) {
      return null;
    }

    const uniqueNames = [...new Set(propNames)]; // Ensure unique names
    const formattedNames = uniqueNames.map(name => `"${name}"`);

    let message = 'Additional propert';
    if (formattedNames.length === 1) {
      message += `y ${formattedNames[0]} exists`;
    } else if (formattedNames.length === 2) {
      message += `ies ${formattedNames[0]} and ${formattedNames[1]} exist`;
    } else {
      const last = formattedNames.pop();
      message += `ies ${formattedNames.join(', ')}, and ${last} exist`;
    }

    return `${message} but are not defined in the schema.`;
  }

  // Helper method to find the line that contains a specific property
  private static findLineWithProperty(lines: string[], propName: string): number {
    const regex = new RegExp(`"${propName}"\s*:`, 'i');
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        return i;
      }
    }
    return -1; // Property not found
  }

  private static renderTable(
    jsonString: string,
    lineData: { errors: string[], warnings: string[] }[],
    globalWarnings: string[] = [],
    globalErrors: string[] = []
  ): string {
    const lines = jsonString.split(/\r?\n/);
    
    // Note: Filtering for 'no pointer info' removed as we now generate a single banner message

    let html = `
<div class="overflow-x-auto border border-slate-200 dark:border-slate-700 
            rounded-lg bg-white dark:bg-slate-900 
            text-slate-800 dark:text-slate-200 p-2 
            font-mono text-sm leading-tight">
`;
    // Render Global Errors First
    for (const errMsg of globalErrors) {
      html += `
  <div class="mb-2 text-red-600 dark:text-red-400 font-semibold">
    ${escapeHtml(errMsg)}
  </div>`;
    }

    // Render the single Global Warning Banner (if it exists)
    for (const warnMsg of globalWarnings) {
      // Use blue for the warning banner background
      html += `
  <div class="mb-2 p-2 rounded bg-blue-500/70 dark:bg-blue-700/70 text-white font-semibold">
    ${escapeHtml(warnMsg)}
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
      const hasWarnings = lineData[idx].warnings.length > 0;
      let rowClasses = '';
      let rowTitle = '';

      if (hasErrors) {
        rowClasses = 'bg-red-600 text-white';
        const combined = lineData[idx].errors.join(' | ');
        rowTitle = `title="${escapeHtml(combined)}"`;
      } else if (hasWarnings) {
        // Change warning row color to blue
        rowClasses = 'bg-blue-500 dark:bg-blue-700 text-white'; 
        const combined = lineData[idx].warnings.join(' | ');
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
