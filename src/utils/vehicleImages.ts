// Vehicle images are stored in uploads folder and accessed directly
export const MONZA_IMAGES = [
  '/lovable-uploads/bb7c50c0-a42a-4d46-92cc-94ae81ca708d.png',
  '/lovable-uploads/180adccf-5b94-4c30-95e9-e6c331461984.png'
];

export const KOMBI_IMAGES = [
  '/lovable-uploads/3915bec9-124f-4947-a8e0-67952e396ba2.png'
];

export const COURIER_IMAGES = [
  '/lovable-uploads/bec4e567-a71f-46c4-8773-837200857dd8.png'
];

export const UNO_IMAGES = [
  '/lovable-uploads/162ff10b-4b68-436a-beb5-579a405249dc.png'
];

export const VAN_IMAGES = [
  '/lovable-uploads/111ea839-6fe8-4da0-89f5-19e402ab8f7b.png'
];

export const AMAROK_IMAGES = [
  '/lovable-uploads/amarok-2012-white.jpeg'
];

export const BMW320I_IMAGES = [
  '/lovable-uploads/bmw320i-hotwheels-blue.jpeg'
];

export const JETTA_IMAGES = [
  '/lovable-uploads/jetta-stage2-black.png'
];

export const FIAT500_IMAGES = [
  '/lovable-uploads/fiat500-rosa.png'
];

export const ESCORT_IMAGES = [
  '/lovable-uploads/escort-conversivel-roxo.jpg'
];

export const HELICOPTERO_IMAGES = [
  '/lovable-uploads/helicoptero-bel206.png'
];

export const FH540_IMAGES = [
  '/lovable-uploads/fh540-rodotrem-azul.png'
];

export const SCANIA440_IMAGES = [
  '/lovable-uploads/scania-440-gray.jpg'
];



export const getVehicleImage = (vehicleName: string, index: number = 0) => {
  if (vehicleName.toLowerCase().includes('monza')) {
    return MONZA_IMAGES[index % MONZA_IMAGES.length];
  }
  if (vehicleName.toLowerCase().includes('kombi')) {
    return KOMBI_IMAGES[index % KOMBI_IMAGES.length];
  }
  if (vehicleName.toLowerCase().includes('courier')) {
    return COURIER_IMAGES[index % COURIER_IMAGES.length];
  }
  if (vehicleName.toLowerCase().includes('uno')) {
    return UNO_IMAGES[index % UNO_IMAGES.length];
  }
  if (vehicleName.toLowerCase().includes('van')) {
    return VAN_IMAGES[index % VAN_IMAGES.length];
  }
  if (vehicleName.toLowerCase().includes('amarok')) {
    return AMAROK_IMAGES[index % AMAROK_IMAGES.length];
  }
  if (vehicleName.toLowerCase().includes('bmw') || vehicleName.toLowerCase().includes('320i')) {
    return BMW320I_IMAGES[index % BMW320I_IMAGES.length];
  }
  if (vehicleName.toLowerCase().includes('jetta')) {
    return JETTA_IMAGES[index % JETTA_IMAGES.length];
  }
  if (vehicleName.toLowerCase().includes('fiat') || vehicleName.toLowerCase().includes('500')) {
    return FIAT500_IMAGES[index % FIAT500_IMAGES.length];
  }
  if (vehicleName.toLowerCase().includes('escort')) {
    return ESCORT_IMAGES[index % ESCORT_IMAGES.length];
  }
  if (vehicleName.toLowerCase().includes('helicoptero') || vehicleName.toLowerCase().includes('bell') || vehicleName.toLowerCase().includes('206')) {
    return HELICOPTERO_IMAGES[index % HELICOPTERO_IMAGES.length];
  }
  if (vehicleName.toLowerCase().includes('fh540') || vehicleName.toLowerCase().includes('rodotrem')) {
    return FH540_IMAGES[index % FH540_IMAGES.length];
  }
  if (vehicleName.toLowerCase().includes('scania') || vehicleName.toLowerCase().includes('440')) {
    return SCANIA440_IMAGES[index % SCANIA440_IMAGES.length];
  }
  return null;
};