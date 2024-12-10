export class PFP {
    private static instance: PFP;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    private constructor(size = 256) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.canvas.height = size;
        this.ctx = this.canvas.getContext("2d")!;
    }

    static generate(seed: string): string {
        if (!this.instance) this.instance = new PFP();
        return this.instance.create(seed);
    }

    private create(seed: string): string {
        const rand = this.prng(seed);
        const ctx = this.ctx;
        const size = this.canvas.width;

        // Clear canvas
        ctx.clearRect(0, 0, size, size);

        // Generate a harmonious color palette with background variance
        const palette = this.generatePalette(rand);

        // Draw background with variable color
        ctx.fillStyle = palette.background;
        ctx.fillRect(0, 0, size, size);

        // Select a composition based on the seed
        const compositionIndex = Math.floor(rand() * 3);

        switch (compositionIndex) {
            case 0:
                this.drawSymmetricalPattern(rand, palette, size);
                break;
            case 1:
                this.drawFractalPattern(rand, palette, size);
                break;
            case 2:
                this.drawSpiralPattern(rand, palette, size);
                break;
        }

        return this.canvas.toDataURL();
    }

    private drawFractalPattern(rand: () => number, palette: Palette, size: number): void {
        const ctx = this.ctx;

        // Variable scaling and overflow
        const scale = 1 + rand() * 1.5;
        const startX = (rand() * size) - size * (scale - 1) / 2;
        const startY = (rand() * size) - size * (scale - 1) / 2;

        const maxDepth = 5 + Math.floor(rand() * 3); // Increase max depth to 5–7
        const initialRadius = (size / 2) * scale * 0.8; // Larger initial radius to occupy more space

        // Determine fractal type based on seed
        const fractalType = Math.floor(rand() * 3);

        if (fractalType === 0) {
            this.drawTreeFractal(rand, ctx, startX, startY, -Math.PI / 2, initialRadius, maxDepth, palette);
        } else if (fractalType === 1) {
            this.drawCircleFractal(rand, ctx, startX, startY, initialRadius, maxDepth, palette);
        } else {
            this.drawPolygonFractal(rand, ctx, startX, startY, initialRadius, maxDepth, palette);
        }
    }

    private drawTreeFractal(rand: () => number, ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, depth: number, palette: Palette): void {
        if (depth === 0 || length < 2) return;

        const x2 = x + Math.cos(angle) * length;
        const y2 = y + Math.sin(angle) * length;

        ctx.strokeStyle = palette.colors[depth % palette.colors.length];
        ctx.lineWidth = depth;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const branches = 2 + Math.floor(rand() * 2); // 2–3 branches
        for (let i = 0; i < branches; i++) {
            const newAngle = angle + (rand() - 0.5) * Math.PI / 2; // Vary angle between branches
            const newLength = length * (0.5 + rand() * 0.3); // Reduce length
            this.drawTreeFractal(rand, ctx, x2, y2, newAngle, newLength, depth - 1, palette);
        }
    }

    private drawCircleFractal(rand: () => number, ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, depth: number, palette: Palette): void {
        if (depth === 0 || radius < 2) return;

        ctx.fillStyle = palette.colors[depth % palette.colors.length];
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        const childCount = 3 + Math.floor(rand() * 3); // 3–5 children
        for (let i = 0; i < childCount; i++) {
            const angle = (i / childCount) * Math.PI * 2 + rand() * Math.PI / childCount;
            const newX = x + Math.cos(angle) * radius;
            const newY = y + Math.sin(angle) * radius;
            const newRadius = radius * 0.5;
            this.drawCircleFractal(rand, ctx, newX, newY, newRadius, depth - 1, palette);
        }
    }

    private drawPolygonFractal(rand: () => number, ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, depth: number, palette: Palette): void {
        if (depth === 0 || radius < 3) return;

        const points = 3 + depth % 5; // Vary points between 3–7
        const rotation = rand() * Math.PI * 2;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            ctx.lineTo(px, py);
        }
        ctx.closePath();

        ctx.fillStyle = palette.colors[depth % palette.colors.length];
        ctx.fill();

        ctx.restore();

        // Recursively draw smaller polygons at each vertex
        for (let i = 0; i < points; i++) {
            const angle = (i / points) * Math.PI * 2 + rotation;
            const newX = x + Math.cos(angle) * radius;
            const newY = y + Math.sin(angle) * radius;
            const newRadius = radius * 0.5;
            this.drawPolygonFractal(rand, ctx, newX, newY, newRadius, depth - 1, palette);
        }
    }

    private drawSymmetricalPattern(rand: () => number, palette: Palette, size: number): void {
        const ctx = this.ctx;

        // Variable scaling and overflow
        const scale = 1 + rand() * 1.5; // Scale between 1x to 2.5x
        const centerX = (rand() * size) - size * (scale - 1) / 2;
        const centerY = (rand() * size) - size * (scale - 1) / 2;

        const layers = 3 + Math.floor(rand() * 3); // 3-5 layers

        for (let i = 0; i < layers; i++) {
            const radius = (size / 2) * scale * ((layers - i) / layers);
            const points = 5 + Math.floor(rand() * 4); // 5-8 points
            const rotation = rand() * Math.PI * 2;

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(rotation);

            ctx.beginPath();
            for (let j = 0; j <= points; j++) {
                const angle = (j / points) * Math.PI * 2;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                ctx.lineTo(x, y);
            }
            ctx.closePath();

            ctx.fillStyle = palette.colors[i % palette.colors.length];
            ctx.fill();

            ctx.restore();
        }
    }

    private drawSpiralPattern(rand: () => number, palette: Palette, size: number): void {
        const ctx = this.ctx;

        // Variable scaling and overflow
        const scale = 1 + rand() * 1.5;
        const centerX = (rand() * size) - size * (scale - 1) / 2;
        const centerY = (rand() * size) - size * (scale - 1) / 2;

        const maxRadius = size / 2 * scale * 1.2;
        const turns = 3 + Math.floor(rand() * 3); // 3-5 turns
        const segments = 100;

        // Variable line thickness
        const baseLineWidth = 2 + rand() * 6; // Line width between 2 to 8
        ctx.lineWidth = baseLineWidth;

        ctx.beginPath();
        for (let i = 0; i <= segments * turns; i++) {
            const t = i / (segments * turns);
            const angle = t * Math.PI * 2 * turns;
            const radius = t * maxRadius;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            ctx.lineTo(x, y);
        }
        ctx.strokeStyle = palette.colors[0];
        ctx.stroke();

        // Draw shapes along the spiral
        const shapeCount = 10 + Math.floor(rand() * 10); // 10-20 shapes
        for (let i = 0; i < shapeCount; i++) {
            const t = i / shapeCount;
            const angle = t * Math.PI * 2 * turns;
            const radius = t * maxRadius;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            const shapeRadius = size / 20 * scale + rand() * size / 20 * scale;
            const points = 3 + Math.floor(rand() * 5);
            const rotation = rand() * Math.PI * 2;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);

            ctx.beginPath();
            for (let j = 0; j <= points; j++) {
                const a = (j / points) * Math.PI * 2;
                const px = Math.cos(a) * shapeRadius;
                const py = Math.sin(a) * shapeRadius;
                ctx.lineTo(px, py);
            }
            ctx.closePath();

            ctx.fillStyle = palette.colors[(i + 1) % palette.colors.length];
            ctx.fill();

            ctx.restore();
        }
    }

    private generatePalette(rand: () => number): Palette {
        const baseHue = rand() * 360;
        const secondaryHue = (baseHue + 30 + rand() * 60) % 360;

        const colors = [
            `hsl(${baseHue}, 70%, 50%)`,
            `hsl(${(baseHue + 120) % 360}, 70%, 50%)`,
            `hsl(${(baseHue + 240) % 360}, 70%, 50%)`,
        ];

        const backgroundColorIndex = Math.floor(rand() * colors.length);
        const background = colors.splice(backgroundColorIndex, 1)[0];

        return {
            background,
            colors,
        };
    }

    private prng(seed: string): () => number {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < seed.length; i++) {
            h ^= seed.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return () => {
            h += h << 13; h ^= h >>> 7;
            h += h << 3; h ^= h >>> 17;
            h += h << 5;
            return (h >>> 0) / 4294967295;
        };
    }
}

interface Palette {
    background: string;
    colors: string[];
}
