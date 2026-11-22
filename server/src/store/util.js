// Um instante em ISO. Fica aqui (e não em cada módulo) porque é a única
// dependência comum a todos os blocos do store.
export const now = () => new Date().toISOString();