// Perfil (bio, privacidade) e avatar.
//
// O estado vive aqui; a página só desenha. Assim o `Settings.jsx` deixa de ter
// dois blocos de estado a competir pelo mesmo `user`.
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { useT } from "../i18n/I18nContext.jsx";
import { imageFileToDataUrl } from "./aparencia.js";

export function usePerfil() {
  const { user, updateAvatar, updateProfile } = useAuth();
  const t = useT();
  const [imgUrl, setImgUrl] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  // Bio/privacidade locais, sincronizadas com o utilizador (ex.: após login).
  useEffect(() => {
    setBio(user?.bio || "");
    setIsPublic(user?.isPublic !== false);
  }, [user]);

  async function pickAvatar(value) {
    setError(null);
    setSaving(true);
    try {
      await updateAvatar(value);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Escolher do PC: reduz a imagem e grava. Uma imagem invalida e' ignorada —
  // o utilizador escolhe outra, sem erro a bloquear a pagina.
  async function pickAvatarFicheiro(file, maxW = 256) {
    if (!file) return;
    try {
      await pickAvatar(await imageFileToDataUrl(file, maxW));
    } catch {
      /* imagem invalida -> ignora */
    }
  }

  async function saveProfile() {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await updateProfile({ bio, isPublic });
      setProfileMsg(t("Perfil atualizado. ✓"));
    } catch (e) {
      setProfileMsg(e.message);
    } finally {
      setProfileSaving(false);
    }
  }

  return {
    user,
    imgUrl,
    setImgUrl,
    bio,
    setBio,
    isPublic,
    setIsPublic,
    saving,
    error,
    pickAvatar,
    pickAvatarFicheiro,
    saveProfile,
    profileSaving,
    profileMsg,
  };
}