import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../lib/useAppTheme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import type { Category } from '../../types/database';
import { PrimaryButton, ScreenScaffold, SectionLabel } from '../../ui/Screen';

export function CreatorUploadScreen() {
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('id, name, slug, parent_id, sort_order, cover_url, created_by')
      .is('parent_id', null)
      .order('sort_order');
    const rows = (data as Category[]) ?? [];
    rows.sort((a, b) => {
      const aScore = a.cover_url || a.created_by ? 0 : 1;
      const bScore = b.cover_url || b.created_by ? 0 : 1;
      if (aScore !== bScore) return aScore - bScore;
      return a.name.localeCompare(b.name);
    });
    setCategories(rows);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (name.length < 2) {
      Alert.alert('Name required', 'Enter at least 2 characters.');
      return;
    }
    setCreatingCategory(true);
    const { data, error } = await supabase.rpc('create_category', { p_name: name });
    setCreatingCategory(false);
    if (error) {
      Alert.alert('Could not create category', error.message);
      return;
    }
    setNewCategoryName('');
    setShowNewCategory(false);
    await loadCategories();
    if (data?.id) setCategoryId(data.id);
    Alert.alert('Category created', `"${name}" is now available to everyone.`);
  };

  const pickAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      setAudioUri(result.assets[0].uri);
      setAudioName(result.assets[0].name);
    }
  };

  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setCoverUri(result.assets[0].uri);
    }
  };

  const submit = async () => {
    if (!user) return;
    if (!title.trim() || !audioUri || !categoryId) {
      Alert.alert('Missing fields', 'Title, audio file, and category are required.');
      return;
    }
    setBusy(true);

    const soundId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    const audioExt = audioName?.split('.').pop() || 'mp3';
    const audioPath = `${user.id}/${soundId}.${audioExt}`;

    const audioRes = await fetch(audioUri);
    const audioBlob = await audioRes.blob();
    const { error: audioError } = await supabase.storage
      .from('sounds')
      .upload(audioPath, audioBlob, {
        upsert: true,
        contentType: audioBlob.type || 'audio/mpeg',
      });

    if (audioError) {
      setBusy(false);
      Alert.alert('Audio upload failed', audioError.message);
      return;
    }

    const { data: signed } = await supabase.storage
      .from('sounds')
      .createSignedUrl(audioPath, 60 * 60 * 24 * 365);

    let coverUrl: string | null = null;
    let coverPath: string | null = null;
    if (coverUri) {
      coverPath = `${user.id}/${soundId}.jpg`;
      const coverRes = await fetch(coverUri);
      const coverBlob = await coverRes.blob();
      const { error: coverError } = await supabase.storage
        .from('covers')
        .upload(coverPath, coverBlob, {
          upsert: true,
          contentType: coverBlob.type || 'image/jpeg',
        });
      if (!coverError) {
        const { data: pub } = supabase.storage.from('covers').getPublicUrl(coverPath);
        coverUrl = pub.publicUrl;
      }
    }

    const { data: sound, error: soundError } = await supabase
      .from('sounds')
      .insert({
        id: soundId,
        creator_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        cover_url: coverUrl,
        audio_path: audioPath,
        audio_url: signed?.signedUrl ?? null,
        duration_seconds: 0,
        status: 'published',
      })
      .select('*')
      .single();

    if (soundError || !sound) {
      setBusy(false);
      Alert.alert('Save failed', soundError?.message ?? 'Unknown error');
      return;
    }

    await supabase.from('sound_categories').insert({
      sound_id: sound.id,
      category_id: categoryId,
    });

    setBusy(false);
    Alert.alert('Published', 'Your sound is live and available in the catalog.');
    navigation.goBack();
  };

  const inputStyle = [
    styles.input,
    {
      color: colors.text,
      borderColor: colors.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surface,
    },
  ];

  return (
    <ScreenScaffold
      title="Upload sound"
      subtitle="Published tracks go live in the catalog right away"
      onBack={() => navigation.goBack()}
    >
      <TextInput
        style={inputStyle}
        placeholder="Title"
        placeholderTextColor={colors.textMuted}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[inputStyle, styles.area]}
        placeholder="Description"
        placeholderTextColor={colors.textMuted}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <SectionLabel>Category</SectionLabel>
      <View style={styles.chips}>
        {categories.map((c) => {
          const selected = categoryId === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCategoryId(c.id)}
              style={[
                styles.chip,
                {
                  borderColor: colors.border,
                  backgroundColor: selected ? colors.inverse : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? colors.inverseText : colors.text,
                  fontFamily: 'DMSans_500Medium',
                  fontSize: 13,
                }}
              >
                {c.name}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setShowNewCategory((v) => !v)}
          style={[styles.chip, { borderColor: colors.border }]}
        >
          <Ionicons name="add" size={14} color={colors.text} />
          <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold', fontSize: 13 }}>
            New
          </Text>
        </Pressable>
      </View>

      {showNewCategory ? (
        <View style={{ marginBottom: 12 }}>
          <TextInput
            style={inputStyle}
            placeholder="New category name"
            placeholderTextColor={colors.textMuted}
            value={newCategoryName}
            onChangeText={setNewCategoryName}
          />
          <PrimaryButton
            label="Create category"
            onPress={createCategory}
            loading={creatingCategory}
            disabled={creatingCategory}
          />
        </View>
      ) : null}

      <Pressable style={[styles.btnOutline, { borderColor: colors.border }]} onPress={pickAudio}>
        <Ionicons name="musical-notes-outline" size={18} color={colors.text} />
        <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }}>
          {audioName ? `Audio: ${audioName}` : 'Pick audio file'}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.btnOutline, { borderColor: colors.border, marginTop: 10 }]}
        onPress={pickCover}
      >
        <Ionicons name="image-outline" size={18} color={colors.text} />
        <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }}>
          {coverUri ? 'Cover selected' : 'Pick cover image (optional)'}
        </Text>
      </Pressable>

      <View style={{ height: 16 }} />
      <PrimaryButton
        label="Publish sound"
        onPress={submit}
        loading={busy}
        disabled={busy}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  input: {
    marginHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
  area: { minHeight: 90, textAlignVertical: 'top' },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnOutline: {
    marginHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
});
