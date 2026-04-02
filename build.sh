#!/bin/sh
# Generate config.js from environment variables during Vercel build
GEMINI_KEY=$(printf '%s' "$GEMINI_API_KEY" | tr -d '\n\r')
GROQ_KEY=$(printf '%s' "$GROQ_API_KEY" | tr -d '\n\r')
printf "window.GITEC_CONFIG = {\n  GEMINI_API_KEY: '%s',\n  GROQ_API_KEY: '%s'\n};\n" "$GEMINI_KEY" "$GROQ_KEY" > js/config.js
