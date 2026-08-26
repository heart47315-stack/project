import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from './src/lib/supabase';
import { registerUser, loginUser, logoutUser, getCurrentUser, requestPasswordReset } from './src/services/authService';
import { searchDrugs } from './src/services/drugService';
import { getProfile, updateProfile } from './src/services/profileService';
import { getUsageHistory, addUsageHistory } from './src/services/historyService';
import { getSavedItems, saveItem, removeSavedItem, isItemSaved } from './src/services/savedService';
import { getUserSettings, updateUserSettings } from './src/services/settingsService';
import appPackage from './package.json';

const BLUE = '#2F6FED';
const DARK = '#18365F';
const BORDER = '#DCE6F5';
const GREEN = '#2DB77A';
const RED = '#E95454';

function Logo({ small = false }) {
  return (
    <View style={styles.logoRow}>
      <View style={[styles.logoBox, small && styles.logoSmall]}>
        <Ionicons name="add" size={small ? 22 : 34} color={BLUE} />
        <View style={styles.logoAI}><Text style={[styles.logoAITxt, small && { fontSize: 8 }]}>AI</Text></View>
      </View>
      {!small && (
        <View>
          <Text style={styles.logoText}>MEDSAFE AI</Text>
          <Text style={styles.logoSub}>ผู้ช่วยสุขภาพอัจฉริยะด้วย AI</Text>
        </View>
      )}
    </View>
  );
}

function Button({ title, onPress, secondary = false, icon, loading = false, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      style={[styles.button, secondary && styles.buttonSecondary, (loading || disabled) && styles.buttonDisabled]}
    >
      {icon && <Ionicons name={icon} size={18} color={secondary ? BLUE : '#fff'} />}
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{loading ? 'กำลังทำงาน...' : title}</Text>
    </Pressable>
  );
}

function Splash({ go }) {
  return (
    <SafeAreaView style={styles.splash}>
      <View style={styles.splashCenter}>
        <Logo />
        <MaterialCommunityIcons name="human" size={155} color="#76A7F7" style={{ marginTop: 22 }} />
        <Text style={styles.splashTag}>สุขภาพของคุณ คือสิ่งสำคัญของเรา</Text>
      </View>
      <Pressable onPress={() => go('onboard1')} style={styles.skip}>
        <Text style={styles.muted}>เริ่มต้นใช้งาน →</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Onboarding({ go, step }) {
  const data = {
    onboard1: ['AI ด้านสุขภาพ', 'ถามคำถามเกี่ยวกับสุขภาพ\nค้นหาข้อมูลทางการแพทย์\nด้วย AI อัจฉริยะ', 'human'],
    onboard2: ['ความปลอดภัยด้านยา', 'ตรวจสอบข้อมูลยาและ\nการใช้ยาอย่างปลอดภัย\nเพื่อสุขภาพที่ดีขึ้น', 'pill'],
    onboard3: ['เส้นทางปลอดภัยด้วย AI', 'วิเคราะห์เส้นทางและ\nความเสี่ยงโดย AI\nเพื่อการเดินทางที่ปลอดภัย', 'map-marker-path'],
  }[step];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.onboardTop}>
        <Text style={styles.step}>0{step.slice(-1)} / 3</Text>
        <Pressable onPress={() => go('login')}><Text style={styles.skipText}>ข้าม</Text></Pressable>
      </View>
      <View style={styles.onboardCenter}>
        <Text style={styles.heroTitle}>{data[0]}</Text>
        <Text style={styles.centerText}>{data[1]}</Text>
        <View style={styles.illustration}>
          <MaterialCommunityIcons name={data[2]} size={150} color="#6E9FF1" />
        </View>
      </View>
      <View>
        <View style={styles.dots}>
          {[1, 2, 3].map((n) => <View key={n} style={[styles.dot, step === `onboard${n}` && styles.dotActive]} />)}
        </View>
        <Button title={step === 'onboard3' ? 'เริ่มใช้งาน' : 'ถัดไป'} onPress={() => go(step === 'onboard1' ? 'onboard2' : step === 'onboard2' ? 'onboard3' : 'login')} />
      </View>
    </SafeAreaView>
  );
}

function Login({ go, onSubmit, onForgot }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setLoading(true);
    try {
      const result = await onSubmit({ email, password });
      if (result?.error) {
        setError(result.error.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.auth}>
        <Logo />
        <Text style={styles.authTitle}>ยินดีต้อนรับกลับ</Text>
        <Text style={styles.muted}>เข้าสู่ระบบเพื่อใช้งาน MedSafe AI</Text>

        {error ? <Text style={styles.errorBox}>{error}</Text> : null}

        <Text style={styles.label}>อีเมล</Text>
        <TextInput
          style={styles.input}
          placeholder="example@email.com"
          keyboardType="email-address"
          value={email}
          autoCapitalize="none"
          onChangeText={setEmail}
        />

        <Text style={styles.label}>รหัสผ่าน</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable style={styles.forgot} onPress={() => onForgot(email)}><Text style={styles.link}>ลืมรหัสผ่าน?</Text></Pressable>
        <Button title="เข้าสู่ระบบ" onPress={handleSubmit} loading={loading} />
        <Text style={styles.or}>หรือ</Text>
        <Text style={[styles.muted, { textAlign: 'center', marginTop: 14 }]}>Google Login ยังไม่ได้เปิดใช้งานใน Supabase configuration</Text>
        <Pressable onPress={() => go('register')}>
          <Text style={styles.register}>ยังไม่มีบัญชี? <Text style={styles.link}>สมัครสมาชิก</Text></Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Register({ go, onSubmit }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    if (!accepted) {
      setError('กรุณายอมรับเงื่อนไขการใช้งานก่อนสมัครสมาชิก');
      return;
    }
    if (password !== confirmPassword) {
      setError('ยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      const result = await onSubmit({ fullName, email, password, confirmPassword });
      if (result?.error) {
        setError(result.error.message || 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่');
      }

      if (result?.needsEmailConfirmation) {
        setError('สมัครสมาชิกสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.auth}>
        <Logo />
        <Text style={styles.authTitle}>สร้างบัญชีใหม่</Text>

        {error ? <Text style={styles.errorBox}>{error}</Text> : null}

        <Text style={styles.label}>ชื่อ-นามสกุล</Text>
        <TextInput style={styles.input} placeholder="กรอกชื่อ-นามสกุล" value={fullName} onChangeText={setFullName} />

        <Text style={styles.label}>อีเมล</Text>
        <TextInput
          style={styles.input}
          placeholder="example@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>รหัสผ่าน</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>ยืนยันรหัสผ่าน</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <Pressable style={styles.checkRow} onPress={() => setAccepted((current) => !current)}>
          <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={20} color={BLUE} />
          <Text style={styles.muted}> ยอมรับเงื่อนไขการใช้งาน</Text>
        </Pressable>

        <Button title="สมัครสมาชิก" onPress={handleSubmit} loading={loading} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Home({ go, user, profile, onSearch }) {
  const [query, setQuery] = useState('');
  const cards = [
    ['AI ด้านสุขภาพ', 'ถามคำถามทางการแพทย์', 'meditation', 'chat'],
    ['ความปลอดภัยด้านยา', 'ตรวจสอบข้อมูลยาและความปลอดภัย', 'pill', 'drugs'],
    ['เส้นทางปลอดภัยด้วย AI', 'วิเคราะห์เส้นทางที่ปลอดภัย', 'map-marker-path', 'route'],
  ];
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'ผู้ใช้งาน';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.home}>
        <View style={styles.homeHeader}>
          <View>
            <Text style={styles.greeting}>สวัสดีค่ะ, {displayName} 👋</Text>
            <Text style={styles.muted}>วันนี้ให้ MedSafe AI ช่วยอะไรคุณ?</Text>
          </View>
          <View style={styles.avatar}><Text>{displayName.charAt(0).toUpperCase()}</Text></View>
        </View>

        <View style={styles.search}>
          <Ionicons name="search" size={18} color="#8B9AB2" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => onSearch(query)}
            placeholder="ค้นหาข้อมูลยา อาการ..."
            returnKeyType="search"
            style={{ flex: 1 }}
          />
          {query ? (
            <Pressable accessibilityLabel="ล้างคำค้นหา" onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color="#8B9AB2" />
            </Pressable>
          ) : null}
        </View>

        {cards.map(([title, desc, icon, target]) => (
          <Pressable key={title} style={styles.featureCard} onPress={() => go(target)}>
            <View style={styles.iconCircle}><MaterialCommunityIcons name={icon} size={29} color={BLUE} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.muted}>{desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={21} color="#8CA0BC" />
          </Pressable>
        ))}

        <Text style={styles.sectionTitle}>การใช้งานล่าสุด</Text>
        <View style={styles.history}>
          <Ionicons name="medkit-outline" size={23} color={BLUE} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.bold}>ค้นหายา</Text>
            <Text style={styles.muted}>ใช้ข้อมูลจากฐานข้อมูลยา</Text>
          </View>
          <Pressable onPress={() => go('drugs')}>
            <Text style={styles.link}>ค้นหา</Text>
          </Pressable>
        </View>
      </ScrollView>
      <BottomNav active="home" go={go} />
    </SafeAreaView>
  );
}

function MedicalAI({ go, onHistory }) {
  const [msg, setMsg] = useState('');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('ยังไม่มี Medical AI/RAG endpoint ที่ผ่านการตรวจสอบ จึงไม่แสดงคำตอบที่สร้างขึ้นโดยไม่มีแหล่งอ้างอิง');

  const send = () => {
    if (!msg.trim()) return;
    const question = msg.trim();
    setMessages((currentMessages) => [...currentMessages, { me: true, text: question }]);
    onHistory?.({ action_type: 'medical_ai', title: 'ใช้งาน Medical AI', description: question, metadata: { query: question } });
    setMsg('');
    setError('ยังส่งคำถามไม่ได้จนกว่าจะตั้งค่า RAG endpoint ที่คืน citations จริง');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Header title="AI ด้านสุขภาพ" go={go} />
      <ScrollView contentContainerStyle={styles.chat}>
        {error ? <Text style={styles.errorBox}>{error}</Text> : null}
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubble, m.me ? styles.me : styles.ai]}>
            <Text style={m.me ? styles.meText : styles.text}>{m.text}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={msg}
          onChangeText={setMsg}
          placeholder="พิมพ์คำถามเป็นภาษาไทยหรือภาษาอังกฤษ..."
          multiline
          textAlignVertical="center"
          style={{ flex: 1, maxHeight: 90 }}
        />
        <Pressable onPress={send} style={styles.send}>
          <Ionicons name="send" color="#fff" size={18} />
        </Pressable>
      </View>
      <BottomNav active="chat" go={go} />
    </SafeAreaView>
  );
}

function DrugSafety({ go, onSelectDrug, initialQuery = '', onHistory }) {
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    const trimmedQuery = q.trim();

    console.log('[UI debug] search input:', trimmedQuery);

    if (!trimmedQuery) {
      setResults([]);
      setLoading(false);
      setError('');
      return () => {
        ignore = true;
      };
    }

    const fetchResults = async () => {
      setLoading(true);
      setError('');

      console.log('[UI debug] calling searchDrugs with:', trimmedQuery);
      const { data, error: searchError } = await searchDrugs(trimmedQuery);

      if (ignore) return;

      console.log('[UI debug] returned data length:', data?.length ?? 0);
      console.log('[UI debug] returned error:', searchError);

      if (searchError) {
        setResults([]);
        setError(searchError.message || 'ไม่สามารถค้นหายาได้ในขณะนี้');
      } else {
        setResults(data || []);
        if (data?.length) onHistory?.({ action_type: 'drug_search', title: 'ค้นหายา', description: trimmedQuery, metadata: { query: trimmedQuery } });
      }

      setLoading(false);
    };

    const timeout = setTimeout(fetchResults, 250);

    return () => {
      ignore = true;
      clearTimeout(timeout);
    };
  }, [q]);

  return (
    <SafeAreaView style={styles.screen}>
      <Header title="ความปลอดภัยด้านยา" go={go} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>ค้นหายา</Text>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color="#8B9AB2" />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="พิมพ์ชื่อยา เช่น พาราเซตามอล หรือ paracetamol"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={{ flex: 1 }}
          />
        </View>

        {loading ? (
          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={BLUE} />
            <Text style={[styles.muted, { marginTop: 8 }]}>กำลังค้นหายา...</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorBox}>{error}</Text> : null}

        {!loading && !error && q.trim() && results.length === 0 ? (
          <Text style={[styles.muted, { marginTop: 14 }]}>ไม่พบยาที่ตรงกับคำค้นหา</Text>
        ) : null}

        {!loading && !q.trim() ? (
          <Text style={[styles.muted, { marginTop: 14 }]}>พิมพ์ชื่อยา ชื่อสารสำคัญ หรือรายละเอียดเป็นภาษาไทยได้</Text>
        ) : null}

        <Text style={styles.sectionTitle}>ผลการค้นหา</Text>
        {results.slice(0, 20).map((drug) => (
          <Pressable
            key={`${drug.drug_name}-${drug.source}`}
            style={styles.medicine}
            onPress={() => {
              onSelectDrug(drug);
              onHistory?.({ action_type: 'drug_detail', title: 'เปิดรายละเอียดยา', description: drug.drug_name || '', metadata: { drug_name: drug.drug_name } });
              go('drugDetail');
            }}
          >
            <View style={[styles.medicineIcon, { backgroundColor: '#EAF2FF' }]}>
              <MaterialCommunityIcons name="pill" size={26} color={BLUE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bold}>{drug.drug_name || 'ไม่ระบุชื่อยา'}</Text>
              <Text style={styles.muted}>{drug.drug_type || 'ไม่ระบุประเภทยา'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9AA8BA" />
          </Pressable>
        ))}

        <View style={styles.safeBox}>
          <Ionicons name="shield-checkmark" size={28} color={GREEN} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.bold}>ตรวจสอบการใช้ยาร่วมกัน</Text>
            <Text style={styles.muted}>ตรวจสอบการใช้ยาร่วมกันอย่างปลอดภัย</Text>
          </View>
        </View>
      </ScrollView>
      <BottomNav active="drugs" go={go} />
    </SafeAreaView>
  );
}

function DrugDetail({ go, selectedDrug, userId, onToggleSave }) {
  const drug = selectedDrug || {};
  const itemId = `${drug.drug_name || ''}:${drug.source || ''}`;
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!userId || !drug.drug_name) return undefined;
    isItemSaved(userId, 'drug', itemId).then((result) => {
      if (mounted && !result.error) setSaved(result.data);
    });
    return () => { mounted = false; };
  }, [userId, itemId, drug.drug_name]);

  const toggleSaved = async () => {
    setSaving(true);
    let result;
    if (saved) {
      const current = await isItemSaved(userId, 'drug', itemId);
      result = current.error ? current : current.item?.id ? await removeSavedItem(userId, current.item.id) : { error: new Error('ไม่พบรายการที่บันทึก') };
    } else {
      result = await saveItem(userId, { item_type: 'drug', item_id: itemId, title: drug.drug_name, description: drug.description, metadata: drug });
    }
    setSaving(false);
    if (result.error) Alert.alert('รายการที่บันทึก', result.error.message || 'ไม่สามารถบันทึกรายการได้');
    else { setSaved(!saved); onToggleSave?.(); }
  };
  const details = [
    ['ชื่อยา', drug.drug_name],
    ['ประเภทยา', drug.drug_type],
    ['รูปแบบยา', drug.dosage_form],
    ['สารสำคัญ', drug.active_ingredient],
    ['คำแนะนำ', drug.indication],
    ['เงื่อนไข', drug.restriction],
    ['คำเตือนและข้อควรระวัง', drug.precautions],
    ['รายละเอียด', drug.description],
    ['แหล่งข้อมูล', drug.source],
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <Header title={drug.drug_name || 'ข้อมูลยา'} go={go} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.drugHero}>
          <View style={styles.bigPill}><MaterialCommunityIcons name="pill" size={55} color={BLUE} /></View>
          <Text style={styles.heroTitle}>{drug.drug_name || 'ไม่ระบุชื่อยา'}</Text>
          <Text style={styles.muted}>{drug.drug_type || 'ไม่ระบุประเภทยา'}</Text>
        </View>

        {details.map(([label, value]) => (
          <View key={label} style={styles.infoBlock}>
            <Text style={styles.cardTitle}>{label}</Text>
            <Text style={styles.muted}>{value || '—'}</Text>
          </View>
        ))}

        <Button title={saved ? 'ยกเลิกการบันทึก' : 'บันทึกยา'} secondary={saved} loading={saving} onPress={toggleSaved} icon={saved ? 'bookmark' : 'bookmark-outline'} />
        <Button title="กลับหน้าค้นหา" onPress={() => go('drugs')} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SafeRoute({ go, onHistory }) {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('SafeRoute ถูกระงับ: ยังไม่มี Google Routes API, accident dataset และ ML model ที่ผ่านการทดสอบ จึงไม่สามารถแสดง route หรือ risk score ได้');

  const assessCurrentLocation = async () => {
    setLoading(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('กรุณาอนุญาตตำแหน่งเพื่อประเมินความเสี่ยงบริเวณปัจจุบัน');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = current.coords;
      setLocation(coords);
      onHistory?.({ action_type: 'safe_route', title: 'ใช้งาน SafeRoute', description: 'ประเมินตำแหน่งปัจจุบัน', metadata: { accuracy: coords.accuracy } });
      setError('พบตำแหน่งปัจจุบันแล้ว แต่การคำนวณความเสี่ยงยัง BLOCKED จนกว่าจะมี model ที่ผ่านการประเมินจาก accident dataset จริง');
    } catch {
      setError('ไม่สามารถอ่านตำแหน่งปัจจุบันได้ กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Header title="เส้นทางปลอดภัยด้วย AI" go={go} />
      <View style={styles.locationPanel}>
        <Ionicons name="navigate-circle-outline" size={76} color={BLUE} />
        <Text style={styles.bold}>ประเมินตำแหน่งปัจจุบัน</Text>
        <Text style={[styles.muted, { textAlign: 'center', marginTop: 6 }]}>ต้องเชื่อมผู้ให้บริการ directions และข้อมูลอุบัติเหตุที่ตรวจสอบได้ก่อนจึงจะแสดงแผนที่และเส้นทาง</Text>
      </View>

      <View style={styles.routeCard}>
        {location ? <Text style={styles.muted}>ตำแหน่งปัจจุบัน: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</Text> : null}
        {error ? <Text style={styles.errorBox}>{error}</Text> : null}
        <Button title="ประเมินตำแหน่งปัจจุบัน" onPress={assessCurrentLocation} loading={loading} />
      </View>
      <BottomNav active="route" go={go} />
    </SafeAreaView>
  );
}

function Profile({ go, user, profile, onLogout }) {
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'ผู้ใช้งาน';
  const displayEmail = user?.email || profile?.email || '';

  return (
    <SafeAreaView style={styles.screen}>
      <Header title="โปรไฟล์" go={go} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profile}>
          <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{displayName.charAt(0).toUpperCase()}</Text></View>
          <Text style={styles.heroTitle}>{displayName}</Text>
          <Text style={styles.muted}>{displayEmail}</Text>
        </View>

        {[
          ['ข้อมูลส่วนตัว', 'personalInfo', 'person-outline'],
          ['ประวัติการใช้งาน', 'history', 'time-outline'],
          ['รายการที่บันทึก', 'saved', 'bookmark-outline'],
          ['ตั้งค่า', 'settings', 'settings-outline'],
          ['เกี่ยวกับ MedSafe AI', 'about', 'information-circle-outline'],
        ].map(([label, target, icon]) => (
          <Pressable key={target} style={styles.menu} onPress={() => go(target)}>
            <Ionicons name="chevron-forward" size={20} color="#8EA0B8" />
            <Text style={{ flex: 1 }}>{label}</Text>
            <Ionicons name={icon} size={21} color={BLUE} />
          </Pressable>
        ))}

        <Button title="ออกจากระบบ" secondary onPress={onLogout} />
      </ScrollView>
      <BottomNav active="profile" go={go} />
    </SafeAreaView>
  );
}

function PersonalInfo({ go, user, profile, onSaved }) {
  const [values, setValues] = useState({ ...profile, email: profile?.email || user?.email || '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setValues({ ...profile, email: profile?.email || user?.email || '' }), [profile, user?.email]);
  const setValue = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!values.full_name?.trim() || !values.email?.trim()) { setError('กรุณากรอกชื่อและอีเมล'); return; }
    if ((values.height && Number.isNaN(Number(values.height))) || (values.weight && Number.isNaN(Number(values.weight)))) { setError('ส่วนสูงและน้ำหนักต้องเป็นตัวเลข'); return; }
    if (values.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(values.date_of_birth)) { setError('วันเกิดต้องอยู่ในรูปแบบ YYYY-MM-DD'); return; }
    setLoading(true); setError('');
    const result = await updateProfile(user.id, values);
    setLoading(false);
    if (result.error) setError(result.error.message || 'บันทึกข้อมูลไม่สำเร็จ');
    else { onSaved(result.data); Alert.alert('ข้อมูลส่วนตัว', 'บันทึกข้อมูลเรียบร้อยแล้ว'); }
  };
  const fields = [['full_name', 'ชื่อ-นามสกุล'], ['email', 'อีเมล'], ['date_of_birth', 'วันเกิด (YYYY-MM-DD)'], ['gender', 'เพศ'], ['height', 'ส่วนสูง'], ['weight', 'น้ำหนัก'], ['blood_type', 'กรุ๊ปเลือด']];
  return <SafeAreaView style={styles.screen}><Header title="ข้อมูลส่วนตัว" go={go} /><ScrollView contentContainerStyle={styles.content}>
    {error ? <Text style={styles.errorBox}>{error}</Text> : null}
    {fields.map(([key, label]) => <View key={key}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={values[key] == null ? '' : String(values[key])} onChangeText={(text) => setValue(key, text)} keyboardType={['height', 'weight'].includes(key) ? 'numeric' : 'default'} /></View>)}
    <Button title="บันทึกข้อมูล" onPress={save} loading={loading} />
  </ScrollView></SafeAreaView>;
}

function History({ go, userId }) {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState('');
  const load = async (isRefresh = false) => { isRefresh ? setRefreshing(true) : setLoading(true); setError(''); const result = await getUsageHistory(userId); if (result.error) setError(result.error.message || 'ไม่สามารถโหลดประวัติได้'); else setItems(result.data); isRefresh ? setRefreshing(false) : setLoading(false); };
  useEffect(() => { load(); }, [userId]);
  return <SafeAreaView style={styles.screen}><Header title="ประวัติการใช้งาน" go={go} /><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
    {loading ? <ActivityIndicator color={BLUE} /> : error ? <Text style={styles.errorBox}>{error}</Text> : items.length === 0 ? <Text style={styles.empty}>{'ยังไม่มีประวัติการใช้งาน'}</Text> : items.map((item) => <View style={styles.infoBlock} key={item.id}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.muted}>{item.description || 'ไม่มีรายละเอียด'}</Text><Text style={styles.muted}>{item.action_type} · {new Date(item.created_at).toLocaleString('th-TH')}</Text></View>)}
  </ScrollView></SafeAreaView>;
}

function Saved({ go, userId, onChanged }) {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = async () => { setLoading(true); setError(''); const result = await getSavedItems(userId); if (result.error) setError(result.error.message || 'ไม่สามารถโหลดรายการบันทึกได้'); else setItems(result.data); setLoading(false); };
  useEffect(() => { load(); }, [userId]);
  const remove = async (id) => { const result = await removeSavedItem(userId, id); if (result.error) Alert.alert('ลบรายการ', result.error.message || 'ลบรายการไม่สำเร็จ'); else { setItems((current) => current.filter((item) => item.id !== id)); onChanged?.(); } };
  return <SafeAreaView style={styles.screen}><Header title="รายการที่บันทึก" go={go} /><ScrollView contentContainerStyle={styles.content}>
    {loading ? <ActivityIndicator color={BLUE} /> : error ? <Text style={styles.errorBox}>{error}</Text> : items.length === 0 ? <Text style={styles.empty}>{'ยังไม่มีรายการที่บันทึก'}</Text> : items.map((item) => <View style={styles.infoBlock} key={item.id}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.muted}>{item.description || 'ไม่มีรายละเอียด'}</Text><Text style={styles.muted}>{item.item_type} · {new Date(item.created_at).toLocaleString('th-TH')}</Text><Button title="ลบรายการ" secondary icon="trash-outline" onPress={() => remove(item.id)} /></View>)}
  </ScrollView></SafeAreaView>;
}

function Settings({ go, userId }) {
  const [settings, setSettings] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { getUserSettings(userId).then((result) => { if (result.error) setError(result.error.message || 'ไม่สามารถโหลดการตั้งค่าได้'); else setSettings(result.data); setLoading(false); }); }, [userId]);
  const toggle = async (value) => { setSettings((current) => ({ ...current, notifications_enabled: value })); const result = await updateUserSettings(userId, { notifications_enabled: value }); if (result.error) { setError(result.error.message || 'บันทึกการตั้งค่าไม่สำเร็จ'); setSettings((current) => ({ ...current, notifications_enabled: !value })); } };
  return <SafeAreaView style={styles.screen}><Header title="ตั้งค่า" go={go} /><ScrollView contentContainerStyle={styles.content}>{loading ? <ActivityIndicator color={BLUE} /> : error ? <Text style={styles.errorBox}>{error}</Text> : <><View style={styles.settingRow}><Text style={styles.cardTitle}>การแจ้งเตือน</Text><Switch value={Boolean(settings?.notifications_enabled)} onValueChange={toggle} trackColor={{ true: '#A9C4FA' }} thumbColor={BLUE} /></View><View style={styles.infoBlock}><Text style={styles.cardTitle}>ภาษา</Text><Text style={styles.muted}>{settings?.language || 'th'}</Text></View></>}</ScrollView></SafeAreaView>;
}

function About({ go }) {
  return <SafeAreaView style={styles.screen}><Header title="เกี่ยวกับ MedSafe AI" go={go} /><ScrollView contentContainerStyle={styles.content}><Logo /><Text style={styles.heroTitle}>MEDSAFE AI</Text><Text style={styles.centerText}>ผู้ช่วยสุขภาพอัจฉริยะด้วย AI</Text><View style={styles.infoBlock}><Text style={styles.cardTitle}>เวอร์ชัน</Text><Text style={styles.muted}>{appPackage.version}</Text></View><View style={styles.infoBlock}><Text style={styles.cardTitle}>คำอธิบายแอป</Text><Text style={styles.muted}>ช่วยค้นหาข้อมูลยาและสนับสนุนการดูแลสุขภาพจากข้อมูลที่มีแหล่งอ้างอิง</Text></View><View style={styles.infoBlock}><Text style={styles.cardTitle}>แหล่งข้อมูลยา</Text><Text style={styles.muted}>ฐานข้อมูลยาและแหล่งข้อมูลที่จัดเก็บในโปรเจกต์ MEDSAFE AI</Text></View><Text style={styles.errorBox}>AI ไม่ใช่แพทย์ ข้อมูลนี้ไม่ใช่การวินิจฉัยหรือคำแนะนำทางการแพทย์</Text></ScrollView></SafeAreaView>;
}

function Header({ title, go }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => go('home')}><Ionicons name="arrow-back" size={24} color={DARK} /></Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <Ionicons name="notifications-outline" size={23} color={DARK} />
    </View>
  );
}

function BottomNav({ active, go }) {
  const items = [
    ['home', 'home', 'หน้าหลัก'],
    ['chat', 'chatbubble-ellipses-outline', 'AI'],
    ['drugs', 'medkit-outline', 'ยา'],
    ['route', 'location-outline', 'เส้นทาง'],
    ['profile', 'person-outline', 'โปรไฟล์'],
  ];

  return (
    <View style={styles.bottom}>
      {items.map(([id, icon, label]) => (
        <Pressable key={id} onPress={() => go(id)} style={styles.navItem}>
          <Ionicons name={icon} size={22} color={active === id ? BLUE : '#9AA8BA'} />
          <Text style={[styles.navText, active === id && { color: BLUE }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState('splash');
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [drugQuery, setDrugQuery] = useState('');

  const loadUserData = async (currentUser) => {
    if (!currentUser?.id) return null;
    const [profileResult, settingsResult, historyResult, savedResult] = await Promise.all([
      getProfile(currentUser.id), getUserSettings(currentUser.id), getUsageHistory(currentUser.id), getSavedItems(currentUser.id),
    ]);
    if (profileResult.error) console.warn('getProfile error:', profileResult.error.message);
    if (settingsResult.error) console.warn('getUserSettings error:', settingsResult.error.message);
    if (historyResult.error) console.warn('getUsageHistory error:', historyResult.error.message);
    if (savedResult.error) console.warn('getSavedItems error:', savedResult.error.message);
    setProfile(profileResult.data);
    setSettings(settingsResult.data);
    setHistory(historyResult.data || []);
    setSavedItems(savedResult.data || []);
    return profileResult.data;
  };

  const go = (s) => setScreen(s);
  const searchFromHome = (query) => {
    setDrugQuery(query.trim());
    setScreen('drugs');
  };

  const recordHistory = async (payload) => {
    const result = await addUsageHistory(user?.id, payload);
    if (result.error) console.warn('addUsageHistory error:', result.error.message);
    else setHistory((current) => [result.data, ...current]);
    return result;
  };

  const handleLogin = async ({ email, password }) => {
    const response = await loginUser({ email, password });
    if (response.error) {
      return response;
    }

    const currentUser = response.data?.user;
    setUser(currentUser);
    await loadUserData(currentUser);
    setScreen('home');
    return { data: response.data };
  };

  const handleRegister = async ({ fullName, email, password }) => {
    const response = await registerUser({ fullName, email, password });
    if (response.error) {
      return response;
    }

    const currentUser = response.data?.user;

    if (response.needsEmailConfirmation || !response.data?.session) {
      setUser(null);
      setProfile(null);
      setScreen('login');
      return {
        data: response.data,
        needsEmailConfirmation: true,
      };
    }

    setUser(currentUser);
    await loadUserData(currentUser);
    setScreen('home');
    return { data: response.data };
  };

  const handleForgotPassword = async (email) => {
    const response = await requestPasswordReset(email);
    if (response.error) {
      Alert.alert('รีเซ็ตรหัสผ่าน', response.error.message);
      return;
    }
    Alert.alert('ส่งอีเมลแล้ว', 'กรุณาตรวจสอบอีเมลเพื่อดำเนินการตั้งรหัสผ่านใหม่');
  };

  const handleLogout = async () => {
    const response = await logoutUser();
    if (response.error) {
      console.warn(response.error.message);
      return;
    }

    setUser(null);
    setProfile(null);
    setHistory([]);
    setSavedItems([]);
    setSettings(null);
    setScreen('login');
  };

  useEffect(() => {
    let mounted = true;

    const initializeSession = async () => {
      const { data } = await getCurrentUser();
      if (!mounted) return;

      if (data) {
        setUser(data);
        await loadUserData(data);
        setScreen('home');
      } else {
        setScreen('login');
      }

      setAuthLoading(false);
    };

    initializeSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);
        await loadUserData(session.user);
        setScreen('home');
      } else {
        setUser(null);
        setProfile(null);
        setHistory([]);
        setSavedItems([]);
        setSettings(null);
        setScreen('login');
      }

      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.auth}>
          <Logo />
          <View style={{ marginTop: 28, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={BLUE} />
            <Text style={[styles.muted, { marginTop: 12, textAlign: 'center' }]}>กำลังตรวจสอบ session...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const screens = {
    splash: <Splash go={go} />,
    onboard1: <Onboarding go={go} step="onboard1" />,
    onboard2: <Onboarding go={go} step="onboard2" />,
    onboard3: <Onboarding go={go} step="onboard3" />,
    login: <Login go={go} onSubmit={handleLogin} onForgot={handleForgotPassword} />,
    register: <Register go={go} onSubmit={handleRegister} />,
    home: <Home go={go} user={user} profile={profile} onSearch={searchFromHome} />,
    chat: <MedicalAI go={go} onHistory={recordHistory} />,
    drugs: <DrugSafety go={go} onSelectDrug={setSelectedDrug} initialQuery={drugQuery} onHistory={recordHistory} />,
    drugDetail: <DrugDetail go={go} selectedDrug={selectedDrug} userId={user?.id} onToggleSave={async () => { const result = await getSavedItems(user?.id); if (!result.error) setSavedItems(result.data); }} />,
    route: <SafeRoute go={go} onHistory={recordHistory} />,
    profile: <Profile go={go} user={user} profile={profile} onLogout={handleLogout} />,
    personalInfo: <PersonalInfo go={go} user={user} profile={profile} onSaved={setProfile} />,
    history: <History go={go} userId={user?.id} />,
    saved: <Saved go={go} userId={user?.id} onChanged={async () => { const result = await getSavedItems(user?.id); if (!result.error) setSavedItems(result.data); }} />,
    settings: <Settings go={go} userId={user?.id} />,
    about: <About go={go} />,
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FBFF" />
      {screens[screen]}
    </>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#F8FBFF', alignItems: 'center', justifyContent: 'center', padding: 28 },
  splashCenter: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  splashTag: { color: '#6F89AB', marginTop: 10, fontSize: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBox: { width: 68, height: 68, borderRadius: 18, borderWidth: 3, borderColor: BLUE, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', position: 'relative' },
  logoSmall: { width: 45, height: 45, borderRadius: 13, borderWidth: 2 },
  logoAI: { position: 'absolute', bottom: 7, right: 8, backgroundColor: '#fff' },
  logoAITxt: { fontWeight: '800', color: BLUE, fontSize: 12 },
  logoText: { fontSize: 28, fontWeight: '800', letterSpacing: 0.4, color: DARK },
  logoSub: { fontSize: 11, color: '#7E91AA', marginTop: 2 },
  screen: { flex: 1, backgroundColor: '#F8FBFF' },
  onboardTop: { flexDirection: 'row', justifyContent: 'space-between', padding: 18 },
  step: { fontSize: 11, color: '#8094AF' },
  skipText: { color: BLUE, fontWeight: '700' },
  onboardCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 25 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: DARK, textAlign: 'center' },
  centerText: { textAlign: 'center', color: '#7186A3', lineHeight: 22, marginTop: 10 },
  illustration: { height: 250, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D4DEEC' },
  dotActive: { width: 23, backgroundColor: BLUE },
  button: { height: 48, borderRadius: 12, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 12 },
  buttonSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  buttonTextSecondary: { color: BLUE },
  muted: { color: '#7D90AA', fontSize: 12, lineHeight: 18 },
  auth: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  authTitle: { fontSize: 25, fontWeight: '800', color: DARK, marginTop: 30, marginBottom: 5 },
  label: { fontSize: 12, color: '#526B8D', fontWeight: '700', marginTop: 18, marginBottom: 7 },
  input: { height: 45, borderWidth: 1, borderColor: BORDER, borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 14, color: DARK },
  forgot: { alignSelf: 'flex-end', marginTop: 8 },
  link: { color: BLUE, fontWeight: '700' },
  or: { textAlign: 'center', color: '#98A7B9', marginVertical: 8 },
  register: { textAlign: 'center', marginTop: 20, color: '#7186A3' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  errorBox: { backgroundColor: '#FFEAEA', borderColor: '#F2B4B4', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12, color: '#B12F2F', fontWeight: '600' },
  home: { padding: 18, paddingBottom: 100 },
  homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 20, fontWeight: '800', color: DARK },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DCE9FF', alignItems: 'center', justifyContent: 'center' },
  search: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 9, marginTop: 18 },
  featureCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4ECF7', borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 11, shadowOpacity: 0.03, shadowRadius: 5 },
  iconCircle: { width: 47, height: 47, borderRadius: 13, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontWeight: '800', color: DARK, fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: DARK, marginTop: 22, marginBottom: 10 },
  history: { backgroundColor: '#fff', borderRadius: 13, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E4ECF7' },
  bold: { fontWeight: '700', color: DARK, fontSize: 13 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 68, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E4ECF7', flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8 },
  navItem: { alignItems: 'center', width: 65 },
  navText: { fontSize: 9, color: '#9AA8BA', marginTop: 2 },
  header: { height: 64, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5ECF6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: DARK },
  chat: { padding: 16, paddingBottom: 20 },
  bubble: { maxWidth: '82%', padding: 12, borderRadius: 15, marginBottom: 10 },
  ai: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER },
  me: { alignSelf: 'flex-end', backgroundColor: BLUE },
  text: { color: DARK, fontSize: 13, lineHeight: 19 },
  meText: { color: '#fff', fontSize: 13, lineHeight: 19 },
  composer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5ECF6', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 100 },
  medicine: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E3EAF5', borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  medicineIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  safeBox: { backgroundColor: '#ECFBF5', borderRadius: 14, padding: 14, flexDirection: 'row', marginTop: 15 },
  drugHero: { alignItems: 'center', paddingVertical: 20 },
  bigPill: { width: 100, height: 100, borderRadius: 28, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  infoBlock: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 13, padding: 15, marginBottom: 10 },
  mapMock: { flex: 1, margin: 14, borderRadius: 18, overflow: 'hidden', backgroundColor: '#EAF2E7', position: 'relative' },
  locationPanel: { flex: 1, margin: 14, borderRadius: 18, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center', padding: 26 },
  mapGrid: { ...StyleSheet.absoluteFillObject, opacity: 0.35, backgroundColor: '#DCE8D6' },
  routeLine: { position: 'absolute', width: 230, height: 10, backgroundColor: '#6C9DF2', transform: [{ rotate: '-28deg' }], top: '52%', left: '18%', borderRadius: 10 },
  pin: { position: 'absolute' },
  mapLabel: { position: 'absolute', top: 15, left: 15, backgroundColor: '#fff', padding: 12, borderRadius: 12 },
  routeCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  score: { flexDirection: 'row', alignItems: 'baseline' },
  scoreNum: { fontSize: 34, fontWeight: '900', color: GREEN },
  score100: { fontSize: 15, color: '#7D90AA' },
  risk: { color: GREEN, fontWeight: '800', marginVertical: 5 },
  profile: { alignItems: 'center', paddingVertical: 15 },
  profileAvatar: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#DCE9FF', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  profileAvatarText: { fontSize: 28, color: BLUE, fontWeight: '800' },
  menu: { height: 57, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EDF1F7', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15 },
  empty: { color: '#7186A3', textAlign: 'center', paddingVertical: 35 },
  settingRow: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 13, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
