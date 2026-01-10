import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		screens: {
			'xs': '475px',
			'sm': '640px',
			'md': '768px',
			'lg': '1024px',
			'xl': '1280px',
			'2xl': '1536px',
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					dark: 'hsl(var(--primary-dark))',
					light: 'hsl(var(--primary-light))'
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
				'gulf-blue': {
					DEFAULT: 'hsl(var(--gulf-blue))',
					light: 'hsl(var(--gulf-blue-light))',
					dark: 'hsl(var(--gulf-blue-dark))'
				},
				'rari-teal': {
					DEFAULT: 'hsl(var(--rari-teal))',
					light: 'hsl(var(--rari-teal-light))',
					dark: 'hsl(var(--rari-teal-dark))',
					foreground: 'hsl(var(--rari-teal-foreground))'
				},
				'rari-blue': {
					DEFAULT: 'hsl(var(--rari-blue))',
					light: 'hsl(var(--rari-blue-light))',
					dark: 'hsl(var(--rari-blue-dark))'
				},
				'performance-orange': {
					DEFAULT: 'hsl(var(--performance-orange))',
					light: 'hsl(var(--performance-orange-light))',
					dark: 'hsl(var(--performance-orange-dark))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))'
				}
			},
			backgroundImage: {
				'gradient-primary': 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
				'gradient-gulf': 'linear-gradient(135deg, hsl(var(--gulf-blue)), hsl(var(--accent)))',
			},
			fontFamily: {
				brand: ['Dfaalt', 'Montserrat', 'system-ui', '-apple-system', 'sans-serif'],
				body: ['Montserrat', 'system-ui', '-apple-system', 'sans-serif'],
				sans: ['Montserrat', 'system-ui', '-apple-system', 'sans-serif'],
				inter: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0', opacity: '0' },
					to: { height: 'var(--radix-accordion-content-height)', opacity: '1' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)', opacity: '1' },
					to: { height: '0', opacity: '0' }
				},
				'fade-in': {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'fade-out': {
					'0%': { opacity: '1', transform: 'translateY(0)' },
					'100%': { opacity: '0', transform: 'translateY(10px)' }
				},
				'scale-in': {
					'0%': { transform: 'scale(0.95)', opacity: '0' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				'scale-out': {
					from: { transform: 'scale(1)', opacity: '1' },
					to: { transform: 'scale(0.95)', opacity: '0' }
				},
				'slide-in-right': {
					'0%': { transform: 'translateX(100%)' },
					'100%': { transform: 'translateX(0)' }
				},
				'slide-out-right': {
					'0%': { transform: 'translateX(0)' },
					'100%': { transform: 'translateX(100%)' }
				},
				'pulse-glow': {
					'0%, 100%': { boxShadow: '0 0 15px hsl(var(--accent) / 0.2)' },
					'50%': { boxShadow: '0 0 25px hsl(var(--accent) / 0.35)' }
				},
				// Enhanced Apple-level animations
				'shimmer': {
					'0%': { backgroundPosition: '-1000px 0' },
					'100%': { backgroundPosition: '1000px 0' }
				},
				'gradient-flow': {
					'0%, 100%': { backgroundPosition: '0% 50%' },
					'50%': { backgroundPosition: '100% 50%' }
				},
				'breathing-glow': {
					'0%, 100%': { 
						boxShadow: '0 0 20px rgba(37, 150, 190, 0.3), 0 0 40px rgba(37, 150, 190, 0.1)',
						transform: 'scale(1)'
					},
					'50%': { 
						boxShadow: '0 0 30px rgba(37, 150, 190, 0.5), 0 0 60px rgba(37, 150, 190, 0.2)',
						transform: 'scale(1.02)'
					}
				},
				'slide-up-fade': {
					'0%': { opacity: '0', transform: 'translateY(20px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'scale-spring': {
					'0%': { transform: 'scale(0.9)' },
					'50%': { transform: 'scale(1.05)' },
					'100%': { transform: 'scale(1)' }
				},
				'pulse-soft': {
					'0%, 100%': { opacity: '0.6' },
					'50%': { opacity: '1' }
				},
				'wave': {
					'0%': { transform: 'scaleY(0.5)' },
					'50%': { transform: 'scaleY(1)' },
					'100%': { transform: 'scaleY(0.5)' }
				},
				'shake': {
					'0%, 100%': { transform: 'translateX(0)' },
					'10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-10px)' },
					'20%, 40%, 60%, 80%': { transform: 'translateX(10px)' }
				},
				'success-scale': {
					'0%': { transform: 'scale(0) rotate(-180deg)', opacity: '0' },
					'50%': { transform: 'scale(1.1) rotate(10deg)' },
					'100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' }
				},
				'draw-check': {
					'0%': { strokeDashoffset: '50' },
					'100%': { strokeDashoffset: '0' }
				},
				'toast-slide-in': {
					'0%': { transform: 'translateX(100%)', opacity: '0' },
					'100%': { transform: 'translateX(0)', opacity: '1' }
				},
				'toast-slide-out': {
					'0%': { transform: 'translateX(0)', opacity: '1' },
					'100%': { transform: 'translateX(100%)', opacity: '0' }
				},
				'pulse-subtle': {
					'0%, 100%': { opacity: '1', transform: 'scale(1)' },
					'50%': { opacity: '0.8', transform: 'scale(0.98)' }
				},
				'pulse-strong': {
					'0%, 100%': { opacity: '1', transform: 'scale(1)', boxShadow: '0 0 0 0 currentColor' },
					'50%': { opacity: '0.9', transform: 'scale(1.05)', boxShadow: '0 0 0 10px transparent' }
				},
				'confetti-fall': {
					'0%': { transform: 'translateY(-100vh) rotate(0deg)', opacity: '1' },
					'100%': { transform: 'translateY(100vh) rotate(360deg)', opacity: '0' }
				},
				'rari-glow': {
					'0%, 100%': { 
						boxShadow: '0 4px 20px rgba(164, 195, 203, 0.3)' 
					},
					'50%': { 
						boxShadow: '0 4px 30px rgba(164, 195, 203, 0.5)' 
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
				'fade-out': 'fade-out 0.3s ease-out',
				'scale-in': 'scale-in 0.2s ease-out',
				'scale-out': 'scale-out 0.2s ease-out',
				'slide-in-right': 'slide-in-right 0.3s ease-out',
				'slide-out-right': 'slide-out-right 0.3s ease-out',
				'pulse-glow': 'pulse-glow 3.5s ease-in-out infinite',
				'enter': 'fade-in 0.3s ease-out, scale-in 0.2s ease-out',
				'exit': 'fade-out 0.3s ease-out, scale-out 0.2s ease-out',
				// Enhanced Apple-level animations
				'shimmer': 'shimmer 2s linear infinite',
				'gradient-flow': 'gradient-flow 3s ease infinite',
				'breathing-glow': 'breathing-glow 3s ease-in-out infinite',
				'slide-up-fade': 'slide-up-fade 0.4s ease-out',
				'scale-spring': 'scale-spring 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
				'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
				'wave': 'wave 1s ease-in-out infinite',
				'shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both',
				'success-scale': 'success-scale 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
				'draw-check': 'draw-check 0.5s ease-in-out forwards',
				'toast-slide-in': 'toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
				'toast-slide-out': 'toast-slide-out 0.2s ease-in forwards',
				'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
				'pulse-strong': 'pulse-strong 1.5s ease-in-out infinite',
				'confetti-fall': 'confetti-fall 3s ease-in-out forwards',
				'rari-glow': 'rari-glow 3s ease-in-out infinite'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
