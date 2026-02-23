# Relatório de Implementação: Atualizador In-App (Auto-Update)

Este relatório descreve o passo a passo de como foi implementada a funcionalidade de "auto-atualização" no Saimo TV V2. Como o aplicativo mobile utiliza a mesma base tecnológica (React Native / Expo), você pode seguir estas exatas instruções para replicar o comportamento lá.

## 1. Instalação de Dependência
Foi necessário instalar o pacote que permite ao Expo "chamar" a tela de instalação nativa de APKs do Android.

**Comando executado:**
```bash
npx expo install expo-intent-launcher
```

## 2. Permissões no `app.json`
A partir do Android 8, o Google exige uma permissão explícita para que aplicativos instalem outros aplicativos (ou a si mesmos).

**Ação:** No arquivo `app.json`, dentro do bloco `android.permissions`, foi adicionada a permissão `REQUEST_INSTALL_PACKAGES`.

**Exemplo de como ficou o `app.json`:**
```json
    "android": {
      "package": "com.seusite.app",
      "permissions": [
        "INTERNET",
        "REQUEST_INSTALL_PACKAGES"
      ]
    },
```

## 3. Criação do Componente `Updater.tsx`
Foi criado o arquivo **`components/Updater.tsx`**. Ele é responsável por:
1. Usar o `expo-file-system/legacy` (ou `expo-file-system` nas versões mais recentes) para baixar o APK na pasta do aplicativo.
2. Ler a versão atual do app usando o `Constants.expoConfig.version`.
3. Fazer um `fetch` (requisição) no arquivo `.json` hospedado online (ex: GitHub).
4. Mostrar o Modal perguntando se o usuário quer atualizar.
5. Exibir a barra de progresso durante o download e abrir o instalador nativo via `IntentLauncher`.

> [!TIP]
> **Adaptação para Celular:** O código original do Saimo TV usava botões do tipo `TVPressable` para garantir navegação por controle remoto. Na versão mobile, você deve substituir esses botões por um `TouchableOpacity` ou `Pressable` padrão do React Native para toques na tela.

**Esqueleto Base do Código Componente:**
```tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

// TODO: Colocar aqui o link RAW do seu GitHub
const UPDATE_URL = "https://raw.githubusercontent.com/.../update.json";

export default function Updater() {
  const [visible, setVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const currentVersion = Constants.expoConfig?.version || '1.0.0';

  const checkUpdate = useCallback(async () => {
    try {
      const response = await fetch(UPDATE_URL, { cache: 'no-store' });
      const data = await response.json();

      if (compareVersions(data.version, currentVersion) > 0) {
        setUpdateInfo(data);
        setVisible(true);
      }
    } catch (error) {
      console.log('Update check failed:', error);
    }
  }, [currentVersion]);

  useEffect(() => { checkUpdate(); }, [checkUpdate]);

  const compareVersions = (v1: string, v2: string) => {
    const v1Parts = v1.split('.').map(Number);
    const v2Parts = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const p1 = v1Parts[i] || 0;
        const p2 = v2Parts[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const apkUri = FileSystem.documentDirectory + 'update.apk';
      const downloadResumable = FileSystem.createDownloadResumable(
        updateInfo.url,
        apkUri,
        {},
        (dp) => setDownloadProgress(dp.totalBytesWritten / dp.totalBytesExpectedToWrite)
      );

      const result = await downloadResumable.downloadAsync();
      if (result) installApk(result.uri);
    } catch (e) {
      setIsDownloading(false);
    }
  };

  const installApk = async (uri: string) => {
    if (Platform.OS === 'android') {
      const cUri = await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: cUri,
        flags: 1,
        type: 'application/vnd.android.package-archive',
      });
      setVisible(false);
    }
    setIsDownloading(false);
  };

  if (!visible) return null;

  // ... (aqui entraria o layout JSX <Modal> de aviso e botão de atualizar)
}
```

## 4. Ponto de Injeção Centralizado
Para que o alerta de atualização surja independentemente de onde o usuário estiver no app, sem precisar colocar o código em várias telas repetidamente, nós o anexamos diretamente no **Layout Principal**.

**Ação:** No arquivo `app/_layout.tsx` (que engloba a navegação do Expo Router), o `<Updater />` foi importado e colocado ao lado do `<Stack>`, garantindo que ele sempre esteja escutando em segundo plano.

**Exemplo de como ficou o `_layout.tsx`:**
```tsx
import { Stack } from 'expo-router';
// Importa o atualizador
import Updater from '../components/Updater';

export default function RootLayout() {
  return (
    <>
      {/* Componente Updater injetado na árvore */}
      <Updater />
      <Stack screenOptions={{ headerShown: false }}>
        {/* rotas... */}
      </Stack>
    </>
  );
}
```

---

## Resumo em Lista: O que fazer no Saimo Cell V2?
1. Rodar `npx expo install expo-intent-launcher`.
2. Incluir a permissão `"REQUEST_INSTALL_PACKAGES"` no `app.json`.
3. Criar o componente `components/Updater.tsx` substituindo as tags `TVPressable` por touch nativo de celular.
4. Adicionar `<Updater />` no `app/_layout.tsx` (Root).
5. Alterar a URL do JSON hospedado online dentro do Updater.
