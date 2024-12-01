import type { SvelteComponent } from "svelte";


export async function hydrateComponent(
  componentName: string,
  props: Record<string, any> = {},
  containerId: string = "svelte-container"
): Promise<SvelteComponent> {
  try {
    const { default: Component } = await import(`../components/${componentName}.svelte`);

    let target = document.getElementById(containerId);
    if (!target) {
      target = document.createElement("div");
      target.id = containerId;
      document.body.appendChild(target);
    }

    const instance = new Component({
      target,
      hydrate: !!target.innerHTML.trim(),
      props,
    });

    return instance;
  } catch (error) {
    console.error(`Failed to hydrate component ${componentName}:`, error);
    throw error;
  }
}

export function hydrateComponentSync<
  Props extends Record<string, any>
>(
  Component: __sveltets_2_IsomorphicComponent<Props, any, any, any, any>,
  props: Props,
  containerId: string = "svelte-container"
): void {
  let target = document.getElementById(containerId);
  if (!target) {
    target = document.createElement("div");
    target.id = containerId;
    document.body.appendChild(target);
  }

  const instance = (Component as any)({
    target,
    props,
  });

  return instance;
}
