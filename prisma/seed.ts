import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const categories = [
  { name: "Almacen", slug: "almacen" },
  { name: "Bebidas", slug: "bebidas" },
  { name: "Limpieza", slug: "limpieza" },
  { name: "Perfumeria", slug: "perfumeria" },
  { name: "Mascotas", slug: "mascotas" }
];

const brands = [
  { name: "Generica", slug: "generica" },
  { name: "Lays", slug: "lays" },
  { name: "Merkao", slug: "merkao" },
  { name: "Dog Chow", slug: "dog-chow" },
  { name: "Coca-Cola", slug: "coca-cola" },
  { name: "Nescafe", slug: "nescafe" },
  { name: "Molto", slug: "molto" },
  { name: "Cif", slug: "cif" },
  { name: "Ayudin", slug: "ayudin" },
  { name: "Colgate", slug: "colgate" },
  { name: "Dove", slug: "dove" },
  { name: "Whiskas", slug: "whiskas" },
  { name: "Pedigree", slug: "pedigree" }
];

type ProductSeedInput = {
  name: string;
  description: string;
  price: string;
  promotionalPrice: string | null;
  stock: number;
  imageUrl: string;
  categorySlug: string;
  brandSlug: string;
};

type CatalogItem = {
  name: string;
  brandSlug: string;
  price: number;
  stock: number;
  promo?: number;
};

const catalogByCategory: Record<string, CatalogItem[]> = {
  almacen: [
    { name: "Arroz largo fino 1 kg", brandSlug: "merkao", price: 1290, stock: 42, promo: 1090 },
    { name: "Fideos mostachol 500 g", brandSlug: "molto", price: 890, stock: 58 },
    { name: "Pure de tomate 520 g", brandSlug: "molto", price: 760, stock: 36, promo: 690 },
    { name: "Aceite girasol 900 ml", brandSlug: "generica", price: 2290, stock: 28 },
    { name: "Harina 000 1 kg", brandSlug: "merkao", price: 950, stock: 47 },
    { name: "Azucar comun 1 kg", brandSlug: "generica", price: 1190, stock: 33, promo: 990 },
    { name: "Yerba mate suave 1 kg", brandSlug: "merkao", price: 3290, stock: 24 },
    { name: "Cafe instantaneo 170 g", brandSlug: "nescafe", price: 5490, stock: 18, promo: 4990 },
    { name: "Te en saquitos x25", brandSlug: "generica", price: 1450, stock: 30 },
    { name: "Galletitas de agua 300 g", brandSlug: "merkao", price: 980, stock: 50 },
    { name: "Papas fritas clasicas 230 g", brandSlug: "lays", price: 2490, stock: 25, promo: 2190 },
    { name: "Mani salado 120 g", brandSlug: "generica", price: 1190, stock: 40 },
    { name: "Atun al natural 170 g", brandSlug: "merkao", price: 2790, stock: 22 },
    { name: "Lentejas secas 400 g", brandSlug: "generica", price: 1350, stock: 31 },
    { name: "Mermelada frutilla 454 g", brandSlug: "merkao", price: 1890, stock: 27, promo: 1690 },
    { name: "Dulce de leche 400 g", brandSlug: "generica", price: 2190, stock: 29 },
    { name: "Sal fina 500 g", brandSlug: "generica", price: 690, stock: 65 },
    { name: "Mayonesa 475 g", brandSlug: "merkao", price: 1690, stock: 34 },
    { name: "Caldo de verduras x12", brandSlug: "generica", price: 990, stock: 41 },
    { name: "Bizcochuelos vainilla 540 g", brandSlug: "molto", price: 1590, stock: 20, promo: 1390 }
  ],
  bebidas: [
    { name: "Gaseosa cola 2.25 l", brandSlug: "coca-cola", price: 2990, stock: 35, promo: 2690 },
    { name: "Gaseosa lima limon 2.25 l", brandSlug: "generica", price: 2190, stock: 32 },
    { name: "Agua mineral sin gas 2 l", brandSlug: "merkao", price: 1150, stock: 54 },
    { name: "Agua mineral con gas 2 l", brandSlug: "merkao", price: 1190, stock: 48 },
    { name: "Jugo naranja 1 l", brandSlug: "generica", price: 1690, stock: 26, promo: 1490 },
    { name: "Jugo manzana 1 l", brandSlug: "generica", price: 1690, stock: 24 },
    { name: "Soda sifon 1.5 l", brandSlug: "merkao", price: 980, stock: 38 },
    { name: "Energizante lata 473 ml", brandSlug: "generica", price: 1890, stock: 19 },
    { name: "Cerveza rubia lata 473 ml", brandSlug: "generica", price: 1490, stock: 42, promo: 1290 },
    { name: "Cerveza negra lata 473 ml", brandSlug: "generica", price: 1590, stock: 28 },
    { name: "Vino tinto 750 ml", brandSlug: "generica", price: 3690, stock: 16 },
    { name: "Vino blanco 750 ml", brandSlug: "generica", price: 3490, stock: 14 },
    { name: "Aperitivo bitter 1 l", brandSlug: "generica", price: 2890, stock: 12 },
    { name: "Isotonica frutos rojos 500 ml", brandSlug: "generica", price: 1390, stock: 27 },
    { name: "Leche chocolatada 1 l", brandSlug: "merkao", price: 1790, stock: 30, promo: 1590 },
    { name: "Agua saborizada pomelo 1.5 l", brandSlug: "generica", price: 1450, stock: 36 },
    { name: "Agua saborizada pera 1.5 l", brandSlug: "generica", price: 1450, stock: 34 },
    { name: "Tonica 1.5 l", brandSlug: "generica", price: 1790, stock: 22 },
    { name: "Jugo en polvo naranja x20 g", brandSlug: "generica", price: 290, stock: 80 },
    { name: "Cafe frio listo 250 ml", brandSlug: "nescafe", price: 1990, stock: 18, promo: 1790 }
  ],
  limpieza: [
    { name: "Detergente concentrado 750 ml", brandSlug: "merkao", price: 1850, stock: 40 },
    { name: "Lavandina 1 l", brandSlug: "ayudin", price: 1290, stock: 45, promo: 1090 },
    { name: "Limpiador cremoso 750 g", brandSlug: "cif", price: 2390, stock: 26 },
    { name: "Desinfectante pisos 900 ml", brandSlug: "merkao", price: 1590, stock: 37 },
    { name: "Jabon en polvo 800 g", brandSlug: "generica", price: 2890, stock: 23 },
    { name: "Suavizante ropa 900 ml", brandSlug: "generica", price: 1790, stock: 28, promo: 1590 },
    { name: "Limpiavidrios 500 ml", brandSlug: "cif", price: 1690, stock: 34 },
    { name: "Desengrasante cocina 500 ml", brandSlug: "cif", price: 1990, stock: 31 },
    { name: "Esponja multiuso x3", brandSlug: "generica", price: 790, stock: 52 },
    { name: "Virulana x6", brandSlug: "generica", price: 690, stock: 47 },
    { name: "Trapo piso algodon", brandSlug: "generica", price: 1290, stock: 33 },
    { name: "Rejilla cocina x2", brandSlug: "generica", price: 890, stock: 41 },
    { name: "Bolsas residuos 45 x 60 x10", brandSlug: "generica", price: 1150, stock: 44 },
    { name: "Bolsas consorcio 80 x 110 x10", brandSlug: "generica", price: 2490, stock: 21, promo: 2190 },
    { name: "Desodorante ambientes 360 ml", brandSlug: "generica", price: 1890, stock: 25 },
    { name: "Insecticida aerosol 360 ml", brandSlug: "generica", price: 2290, stock: 18 },
    { name: "Guantes latex medianos", brandSlug: "generica", price: 1490, stock: 29 },
    { name: "Paño microfibra x2", brandSlug: "generica", price: 1390, stock: 36 },
    { name: "Cera liquida pisos 900 ml", brandSlug: "merkao", price: 2190, stock: 19 },
    { name: "Pastillas sanitarias x3", brandSlug: "ayudin", price: 990, stock: 46, promo: 850 }
  ],
  perfumeria: [
    { name: "Shampoo reparacion 400 ml", brandSlug: "dove", price: 3290, stock: 28, promo: 2990 },
    { name: "Acondicionador reparacion 400 ml", brandSlug: "dove", price: 3290, stock: 25 },
    { name: "Jabon tocador x3", brandSlug: "dove", price: 1890, stock: 34 },
    { name: "Pasta dental 90 g", brandSlug: "colgate", price: 1590, stock: 45, promo: 1390 },
    { name: "Cepillo dental medio", brandSlug: "colgate", price: 1290, stock: 38 },
    { name: "Enjuague bucal 500 ml", brandSlug: "colgate", price: 3490, stock: 19 },
    { name: "Desodorante aerosol hombre", brandSlug: "generica", price: 2490, stock: 31 },
    { name: "Desodorante aerosol mujer", brandSlug: "generica", price: 2490, stock: 32 },
    { name: "Crema corporal 250 ml", brandSlug: "dove", price: 2890, stock: 24 },
    { name: "Alcohol en gel 250 ml", brandSlug: "generica", price: 1190, stock: 40 },
    { name: "Papel higienico hoja doble x4", brandSlug: "generica", price: 2190, stock: 36, promo: 1990 },
    { name: "Rollos cocina x3", brandSlug: "generica", price: 1790, stock: 39 },
    { name: "Panuelos descartables x6", brandSlug: "generica", price: 1290, stock: 29 },
    { name: "Toallas femeninas x16", brandSlug: "generica", price: 1690, stock: 33 },
    { name: "Protectores diarios x20", brandSlug: "generica", price: 1390, stock: 27 },
    { name: "Maquina afeitar descartable x3", brandSlug: "generica", price: 1990, stock: 22 },
    { name: "Espuma afeitar 200 ml", brandSlug: "generica", price: 2590, stock: 16 },
    { name: "Algodon 100 g", brandSlug: "generica", price: 990, stock: 35 },
    { name: "Hisopos x125", brandSlug: "generica", price: 890, stock: 43 },
    { name: "Talco corporal 200 g", brandSlug: "generica", price: 1490, stock: 20, promo: 1290 }
  ],
  mascotas: [
    { name: "Alimento perro adulto 3 kg", brandSlug: "dog-chow", price: 12900, stock: 12, promo: 11900 },
    { name: "Alimento perro cachorro 3 kg", brandSlug: "dog-chow", price: 13900, stock: 10 },
    { name: "Alimento gato adulto 1 kg", brandSlug: "whiskas", price: 4890, stock: 22, promo: 4490 },
    { name: "Alimento gato cachorro 1 kg", brandSlug: "whiskas", price: 5190, stock: 18 },
    { name: "Sobrecito gato atun 85 g", brandSlug: "whiskas", price: 790, stock: 48 },
    { name: "Sobrecito perro carne 100 g", brandSlug: "pedigree", price: 850, stock: 44 },
    { name: "Snacks perro huesitos 100 g", brandSlug: "pedigree", price: 1290, stock: 30 },
    { name: "Galletitas perro 500 g", brandSlug: "generica", price: 2190, stock: 24 },
    { name: "Piedras sanitarias 4 kg", brandSlug: "generica", price: 3490, stock: 20, promo: 3190 },
    { name: "Arena aglutinante 4 kg", brandSlug: "generica", price: 4290, stock: 14 },
    { name: "Shampoo mascotas 250 ml", brandSlug: "generica", price: 1990, stock: 21 },
    { name: "Pipeta perro mediano", brandSlug: "generica", price: 2890, stock: 17 },
    { name: "Pipeta gato adulto", brandSlug: "generica", price: 2690, stock: 15 },
    { name: "Correa nylon mediana", brandSlug: "generica", price: 3290, stock: 11 },
    { name: "Collar regulable chico", brandSlug: "generica", price: 1890, stock: 16 },
    { name: "Comedero plastico chico", brandSlug: "generica", price: 1490, stock: 26 },
    { name: "Bebedero plastico chico", brandSlug: "generica", price: 1490, stock: 24 },
    { name: "Juguete mordillo perro", brandSlug: "generica", price: 1590, stock: 19 },
    { name: "Pelota cascabel gato", brandSlug: "generica", price: 990, stock: 32 },
    { name: "Bolsa higiene mascotas x20", brandSlug: "generica", price: 1190, stock: 37, promo: 990 }
  ]
};

const categoryDescriptions: Record<string, string> = {
  almacen: "Producto de almacen para reposicion diaria.",
  bebidas: "Bebida lista para gondola y consumo familiar.",
  limpieza: "Articulo de limpieza para el cuidado del hogar.",
  perfumeria: "Producto de perfumeria e higiene personal.",
  mascotas: "Articulo para el cuidado y alimento de mascotas."
};

function productImageUrl(productName: string) {
  const label = encodeURIComponent(productName.replace(/\s+/g, " ").trim());
  return `https://placehold.co/600x600/png?text=${label}&font=roboto`;
}

const products: ProductSeedInput[] = Object.entries(catalogByCategory).flatMap(
  ([categorySlug, catalog]) =>
    catalog.map((item) => ({
      name: item.name,
      description: categoryDescriptions[categorySlug],
      price: item.price.toFixed(2),
      promotionalPrice: item.promo ? item.promo.toFixed(2) : null,
      stock: item.stock,
      imageUrl: productImageUrl(item.name),
      categorySlug,
      brandSlug: item.brandSlug
    }))
);

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category
    });
  }

  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: brand,
      create: brand
    });
  }

  const passwordHash = await bcrypt.hash("Demo1234", 10);
  const user = await prisma.user.upsert({
    where: { email: "demo@merkao.local" },
    update: { name: "Usuario Demo", passwordHash, role: "CUSTOMER" },
    create: {
      name: "Usuario Demo",
      email: "demo@merkao.local",
      passwordHash,
      role: "CUSTOMER"
    }
  });

  await prisma.user.upsert({
    where: { email: "admin@merkao.local" },
    update: { name: "Admin Merkao", passwordHash, role: "ADMIN" },
    create: {
      name: "Admin Merkao",
      email: "admin@merkao.local",
      passwordHash,
      role: "ADMIN"
    }
  });

  await prisma.address.upsert({
    where: { id: "address_demo_default" },
    update: {
      userId: user.id,
      label: "Casa",
      recipientName: "Usuario Demo",
      street: "Av. Siempre Viva 742",
      city: "Buenos Aires",
      province: "CABA",
      postalCode: "1000",
      phone: "1144445555",
      isDefault: true
    },
    create: {
      id: "address_demo_default",
      userId: user.id,
      label: "Casa",
      recipientName: "Usuario Demo",
      street: "Av. Siempre Viva 742",
      city: "Buenos Aires",
      province: "CABA",
      postalCode: "1000",
      phone: "1144445555",
      isDefault: true
    }
  });

  for (const product of products) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: product.categorySlug }
    });
    const brand = await prisma.brand.findUniqueOrThrow({
      where: { slug: product.brandSlug }
    });

    const existing = await prisma.product.findFirst({
      where: { name: product.name, ownerId: user.id }
    });

    const data = {
      description: product.description,
      price: product.price,
      promotionalPrice: product.promotionalPrice,
      stock: product.stock,
      imageUrl: product.imageUrl,
      categoryId: category.id,
      brandId: brand.id,
      isActive: true
    };

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data
      });
    } else {
      await prisma.product.create({
        data: {
          name: product.name,
          ...data,
          ownerId: user.id
        }
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
