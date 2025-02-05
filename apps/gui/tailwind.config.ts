import { fontFamily } from 'tailwindcss/defaultTheme';
import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
	important: true,
	darkMode: ['class'],
	content: ['./src/**/*.{html,js,svelte,ts}'],
	safelist: [
		'dark',
		'map-light',
		'map-dark'
	],
	theme: {
    	container: {
    		center: true,
    		padding: '2rem',
    		screens: {
    			'2xl': '1400px'
    		}
    	},
    	extend: {
			backgroundSize: {
				'size-200': '200% 200%',
			},
			backgroundPosition: {
			'pos-0': '0% 0%',
			'pos-100': '100% 100%',
			},
    		keyframes: {
    			flash: {
    				'0%': {
    					backgroundColor: 'rgba(238,130,238, 0)'
    				},
    				'5%': {
    					backgroundColor: 'rgba(238,130,238, 0.05)'
    				},
    				'100%': {
    					backgroundColor: 'rgba(238,130,238, 0)'
    				}
    			}
    		},
    		animation: {
    			flash: 'flash 1s ease-out'
    		},
    		boxShadow: {
    			'offset-20': '20px 20px 0px rgba(255,255,255,0.03)',
    			start: '10px 10px 0px 1px rgba(255,255,255,0.03)',
    			end: '20px 20px 0px 1px rgba(255,255,255,0.03)'
    		},
    		colors: {
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			chart: {
    				'1': 'hsl(var(--chart-1))',
    				'2': 'hsl(var(--chart-2))',
    				'3': 'hsl(var(--chart-3))',
    				'4': 'hsl(var(--chart-4))',
    				'5': 'hsl(var(--chart-5))'
    			}
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
    		fontFamily: {
    			sans: [
    				'Inter',
                    ...fontFamily.sans
                ]
    		}
    	}
    },
    plugins: [
		require("tailwindcss-animate"),
		plugin(({ addComponents }) => {
			const gradients = {
			  '.gradient-violet': {
				'@apply bg-gradient-to-br from-violet-300/5 to-violet-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100': {},
			  },
			  '.dark .gradient-violet': {
				'@apply from-violet-600/5 to-violet-600/30': {},
			  },
			  '.gradient-blue': {
				'@apply bg-gradient-to-br from-blue-300/5 to-blue-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100': {},
			  },
			  '.dark .gradient-blue': {
				'@apply from-blue-600/5 to-blue-600/30': {},
			  },
			  '.gradient-green': {
				'@apply bg-gradient-to-br from-green-300/5 to-green-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100': {},
			  },
			  '.dark .gradient-green': {
				'@apply from-green-600/5 to-green-600/30': {},
			  },
			  '.gradient-yellow': {
				'@apply bg-gradient-to-br from-yellow-300/5 to-yellow-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100': {},
			  },
			  '.dark .gradient-yellow': {
				'@apply from-yellow-600/5 to-yellow-600/30': {},
			  },
			  '.gradient-orange': {
				'@apply bg-gradient-to-br from-orange-300/5 to-orange-300/30 transition-all duration-1000 bg-size-200 bg-pos-0 hover:bg-pos-100': {},
			  },
			  '.dark .gradient-orange': {
				'@apply from-orange-600/50 to-orange-600/80': {},
			  },
			  '.gradient-red': {
				'@apply bg-gradient-to-br from-red-300/5 to-red-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100': {},
			  },
			  '.dark .gradient-red': {
				'@apply from-red-600/5 to-red-600/30': {},
			  },
			  '.gradient-pink': {
				'@apply bg-gradient-to-br from-pink-300/5 to-pink-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100': {},
			  },
			  '.dark .gradient-pink': {
				'@apply from-pink-600/5 to-pink-600/30': {},
			  },
			  '.gradient-purple': {
				'@apply bg-gradient-to-br from-purple-300/5 to-purple-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100': {},
			  },
			  '.dark .gradient-purple': {
				'@apply from-purple-600/5 to-purple-600/30': {},
			  },
			  '.gradient-teal': {
				'@apply bg-gradient-to-br from-teal-300/5 to-teal-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100': {},
			  },
			  '.dark .gradient-teal': {
				'@apply from-teal-600/5 to-teal-600/30': {},
			  },
			  '.gradient-indigo': {
				'@apply bg-gradient-to-br from-indigo-300/5 to-indigo-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100': {},
			  },
			  '.dark .gradient-indigo': {
				'@apply from-indigo-600/5 to-indigo-600/30': {},
			  },
			  '.gradient-gray': {
				'@apply bg-gradient-to-br from-gray-300/5 to-gray-300/30 transition-all duration-500 bg-size-200 bg-pos-0 hover:bg-pos-100': {},
			  },
			  '.dark .gradient-gray': {
				'@apply from-gray-600/5 to-gray-600/30': {},
			  },
			};
			addComponents(gradients);
		  }),
	]
};

export default config;
