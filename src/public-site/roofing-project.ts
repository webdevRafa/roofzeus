import { roofMaterials } from "./modernize";

export const roofingPlans = ["repair", "replacement", "new"];
export const roofingTimeframes = ["Immediately", "1-6 months", "Don't know"];
export type RoofingProject = {
  plan: string;
  material: string;
  timeframe: string;
};

export function availableRoofMaterial(material: string, materials: string[]) {
  return Object.hasOwn(roofMaterials, material) && materials.includes(material);
}
export function roofingProjectReady(
  project: RoofingProject,
  materials: string[],
) {
  return (
    roofingPlans.includes(project.plan) &&
    availableRoofMaterial(project.material, materials) &&
    roofingTimeframes.includes(project.timeframe)
  );
}
