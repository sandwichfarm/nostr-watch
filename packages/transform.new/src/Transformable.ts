import { plainToClass as p2c, classToPlain as c2p } from 'class-transformer';

export abstract class Transformable {
    static plainToClass<T>(cls: new (...args: any[]) => T, plain: object): T {
        return p2c(cls, plain, { excludeExtraneousValues: true });
    }

    classToPlain(): object {
        return c2p(this);
    }

    // Moved getExtraFields method here if it's commonly used across different types
    protected getExtraFields(object: any, parentKey: string = ''): string[] {
        let extraFields: string[] = [];

        for (const key of Object.keys(object)) {
            const fullKey = parentKey ? `${parentKey}.${key}` : key;

            if (!this.hasOwnProperty(key)) {
                extraFields.push(fullKey);
            } else if (object[key] !== null && typeof object[key] === 'object' && !Array.isArray(object[key])) {
                extraFields = extraFields.concat(this.getExtraFields(object[key], fullKey));
            }
        }

        return extraFields;
    }
}
