# 📚 BookSwipe

Intercambia libros usados con lectores cerca de ti. App estilo Tinder para libros con login, subida de fotos y sistema de matches.

## Stack
- **Backend:** Node.js + Express + SQLite + Multer
- **Frontend:** HTML/CSS/JS (vanilla)
- **Deploy:** Vercel

## Desarrollo local

```bash
npm install
npm run dev
# Abre http://localhost:3000
```

## Deploy en Vercel

### 1. Sube el código a GitHub
```bash
git init
git add .
git commit -m "🚀 BookSwipe inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/bookswipe.git
git push -u origin main
```

### 2. Conecta con Vercel
1. Ve a [vercel.com](https://vercel.com) → **Add New Project**
2. Importa tu repositorio de GitHub
3. En **Environment Variables** agrega:
   - `JWT_SECRET` → una cadena secreta larga (ej: `mi-super-secreto-bookswipe-2024`)
4. Click **Deploy** ✅

### 3. Nota sobre almacenamiento en Vercel
Vercel es **serverless**, por lo que el sistema de archivos es temporal (`/tmp`).  
Para producción real se recomienda migrar a:
- **Imágenes:** [Cloudinary](https://cloudinary.com) (gratis) o AWS S3
- **Base de datos:** [PlanetScale](https://planetscale.com) o [Turso](https://turso.tech) (SQLite en la nube)

Para un proyecto personal o demo, Vercel funciona perfectamente.

## Estructura del proyecto
```
bookswipe/
├── api/
│   └── index.js        # Backend Express + SQLite
├── public/
│   ├── index.html      # Frontend completo
│   └── uploads/        # Fotos subidas (local)
├── package.json
├── vercel.json
└── .gitignore
```

## Features
- ✅ Login / Registro con email y contraseña (JWT)
- ✅ Swipe de libros (arrastrar o botones)
- ✅ Carrusel de hasta 4 fotos reales por libro
- ✅ Publicar libros con fotos, género, estado 1-10
- ✅ Sistema de matches automático
- ✅ Vista Explorar con filtros por género e importancia
- ✅ Panel "Mis libros" con opción de eliminar
