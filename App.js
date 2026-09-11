import React, { useState, useEffect, useRef } from 'react';
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
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { MapView, Marker, Polyline } from './src/lib/map-web-safe';
import { supabase } from './src/lib/supabase';
import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  requestPasswordReset,
  updatePassword,
} from './src/services/authService';
import { searchDrugs } from './src/services/drugService';
import { sendMedicalQuestion } from './src/services/medicalAiService';
import { getProfile, updateProfile } from './src/services/profileService';
import { getUsageHistory, addUsageHistory } from './src/services/historyService';
import { getSavedItems, saveItem, removeSavedItem, isItemSaved } from './src/services/savedService';
import { getUserSettings, updateUserSettings } from './src/services/settingsService';
import { getAdminDashboard } from './src/services/adminService';
import { searchHospitals, getNearbyHospitals } from './src/services/hospitalService';
import { evaluateRouteRisk } from './src/services/safeRouteService';
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
          autoCorrect={false}
          textContentType="emailAddress"
          inputMode="email"
          onChangeText={setEmail}
        />

        <Text style={styles.label}>รหัสผ่าน</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          secureTextEntry
          value={password}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          inputMode="text"
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
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bloodType, setBloodType] = useState('');
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
    if (height && Number.isNaN(Number(height))) {
      setError('ส่วนสูงต้องเป็นตัวเลข');
      return;
    }
    if (weight && Number.isNaN(Number(weight))) {
      setError('น้ำหนักต้องเป็นตัวเลข');
      return;
    }
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      setError('วันเกิดต้องอยู่ในรูปแบบ YYYY-MM-DD');
      return;
    }

    setLoading(true);
    try {
      const result = await onSubmit({
        fullName,
        email,
        password,
        confirmPassword,
        dateOfBirth,
        gender,
        height,
        weight,
        bloodType,
      });
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
        <TextInput style={styles.input} placeholder="กรอกชื่อ-นามสกุล" value={fullName} autoCapitalize="words" autoCorrect={false} onChangeText={setFullName} />

        <Text style={styles.label}>อีเมล</Text>
        <TextInput
          style={styles.input}
          placeholder="example@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>วันเกิด (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="2026-01-31"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="numeric"
        />

        <Text style={styles.label}>เพศ</Text>
        <TextInput
          style={styles.input}
          placeholder="ชาย / หญิง / อื่นๆ"
          value={gender}
          onChangeText={setGender}
          autoCapitalize="words"
          autoCorrect={false}
          inputMode="text"
        />

        <Text style={styles.label}>ส่วนสูง (cm)</Text>
        <TextInput
          style={styles.input}
          placeholder="170"
          keyboardType="numeric"
          value={height}
          inputMode="numeric"
          onChangeText={setHeight}
        />

        <Text style={styles.label}>น้ำหนัก (kg)</Text>
        <TextInput
          style={styles.input}
          placeholder="65"
          keyboardType="numeric"
          value={weight}
          inputMode="numeric"
          onChangeText={setWeight}
        />

        <Text style={styles.label}>กรุ๊ปเลือด</Text>
        <TextInput
          style={styles.input}
          placeholder="A, B, AB, O"
          value={bloodType}
          onChangeText={setBloodType}
          autoCapitalize="characters"
          autoCorrect={false}
          inputMode="text"
        />

        <Text style={styles.label}>รหัสผ่าน</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          secureTextEntry
          value={password}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          onChangeText={setPassword}
        />

        <Text style={styles.label}>ยืนยันรหัสผ่าน</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          secureTextEntry
          value={confirmPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          onChangeText={setConfirmPassword}
        />

        <Pressable style={styles.checkRow} onPress={() => setAccepted((current) => !current)}>
          <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={20} color={BLUE} />
          <Text style={styles.muted}> ยอมรับเงื่อนไขการใช้งาน</Text>
        </Pressable>

        <Button title="สมัครสมาชิก" onPress={handleSubmit} loading={loading} />
        <Pressable onPress={() => go('login')}>
          <Text style={styles.register}>มีบัญชีแล้ว? <Text style={styles.link}>เข้าสู่ระบบ</Text></Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ForgotPassword({ go, onSubmit }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setMessage('');
    setError('');
    if (!email.trim()) {
      setError('กรุณากรอกอีเมล');
      return;
    }

    setLoading(true);
    try {
      const result = await onSubmit(email);
      if (result?.error) {
        setError(result.error.message || 'ไม่สามารถส่งอีเมลได้');
        return;
      }
      setMessage(
        `ส่งลิงก์เปลี่ยนรหัสผ่านไปที่ ${email.trim().toLowerCase()} แล้ว\nกรุณาเปิดอีเมลและกดลิงก์ ระบบจะเปิดแอปเพื่อให้ตั้งรหัสผ่านใหม่`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.auth}>
        <View style={styles.authBackRow}>
          <Pressable accessibilityLabel="ย้อนกลับ" onPress={() => go('login')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={23} color={DARK} />
            <Text style={styles.backText}>ย้อนกลับ</Text>
          </Pressable>
        </View>

        <Logo />
        <Text style={styles.authTitle}>ลืมรหัสผ่าน</Text>
        <Text style={[styles.muted, { marginBottom: 18 }]}>
          กรอกอีเมลที่ใช้สมัครสมาชิก แล้วเราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้
        </Text>

        {error ? <Text style={styles.errorBox}>{error}</Text> : null}
        {message ? <Text style={styles.successBox}>{message}</Text> : null}

        <Text style={styles.label}>อีเมล</Text>
        <TextInput
          style={styles.input}
          placeholder="example@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          inputMode="email"
          value={email}
          onChangeText={setEmail}
        />

        <Button title="ส่งอีเมลเปลี่ยนรหัสผ่าน" onPress={handleSubmit} loading={loading} />
        <Pressable onPress={() => go('login')} style={{ marginTop: 16 }}>
          <Text style={[styles.link, { textAlign: 'center' }]}>กลับไปหน้าเข้าสู่ระบบ</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ResetPassword({ go, onSubmit }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');

    if (!password || !confirmPassword) {
      setError('กรุณากรอกรหัสผ่านใหม่ให้ครบถ้วน');
      return;
    }
    if (password.length < 8) {
      setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (password !== confirmPassword) {
      setError('ยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      const result = await onSubmit(password);
      if (result?.error) {
        setError(result.error.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
        return;
      }
      Alert.alert('เปลี่ยนรหัสผ่านสำเร็จ', 'รหัสผ่านใหม่ถูกบันทึกใน Supabase แล้ว', [
        { text: 'เข้าสู่ระบบ', onPress: () => go('login') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.auth}>
        <View style={styles.authBackRow}>
          <Pressable accessibilityLabel="ย้อนกลับ" onPress={() => go('login')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={23} color={DARK} />
            <Text style={styles.backText}>ย้อนกลับ</Text>
          </Pressable>
        </View>

        <Logo />
        <Text style={styles.authTitle}>ตั้งรหัสผ่านใหม่</Text>
        <Text style={[styles.muted, { marginBottom: 18 }]}>
          ตั้งรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร
        </Text>

        {error ? <Text style={styles.errorBox}>{error}</Text> : null}

        <Text style={styles.label}>รหัสผ่านใหม่</Text>
        <TextInput style={styles.input} placeholder="อย่างน้อย 8 ตัวอักษร" secureTextEntry value={password} autoCapitalize="none" autoCorrect={false} textContentType="newPassword" inputMode="text" onChangeText={setPassword} />

        <Text style={styles.label}>ยืนยันรหัสผ่านใหม่</Text>
        <TextInput style={styles.input} placeholder="กรอกรหัสผ่านอีกครั้ง" secureTextEntry value={confirmPassword} autoCapitalize="none" autoCorrect={false} textContentType="newPassword" inputMode="text" onChangeText={setConfirmPassword} />

        <Button title="บันทึกรหัสผ่านใหม่" onPress={handleSubmit} loading={loading} />
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
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="text"
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!msg.trim()) return;
    const question = msg.trim();
    const userMessage = { me: true, text: question };
    setMessages((currentMessages) => [...currentMessages, userMessage]);
    onHistory?.({ action_type: 'medical_ai', title: 'ใช้งาน Medical AI', description: question, metadata: { query: question } });
    setMsg('');
    setError('');
    setLoading(true);

    const result = await sendMedicalQuestion(question, messages);
    if (result.error) {
      setError(result.error.message || 'ไม่สามารถส่งคำถามได้ กรุณาลองใหม่');
    } else {
      setMessages((currentMessages) => [...currentMessages, { me: false, text: result.data.answer }]);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Header title="AI ด้านสุขภาพ" go={go} />
      <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chat} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errorBox}>{error}</Text> : null}
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubble, m.me ? styles.me : styles.ai]}>
            <Text style={m.me ? styles.meText : styles.text}>{m.text}</Text>
          </View>
        ))}
        {loading ? <ActivityIndicator color={BLUE} style={{ alignSelf: 'flex-start', margin: 10 }} /> : null}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={msg}
          onChangeText={setMsg}
          placeholder="พิมพ์ภาษาไทยหรือ English..."
          accessibilityLabel="ช่องพิมพ์คำถามภาษาไทยหรือภาษาอังกฤษ"
          keyboardType="default"
          autoCapitalize="sentences"
          autoCorrect={true}
          inputMode="text"
          multiline
          blurOnSubmit={false}
          textAlignVertical="top"
          style={styles.composerInput}
        />
        <Pressable onPress={send} disabled={loading || !msg.trim()} style={[styles.send, (loading || !msg.trim()) && styles.buttonDisabled]}>
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
            inputMode="text"
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
  const [searchLoading, setSearchLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [destination, setDestination] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [routePoints, setRoutePoints] = useState([
    { latitude: 13.7563, longitude: 100.5018 },
    { latitude: 13.7611, longitude: 100.5081 },
    { latitude: 13.7657, longitude: 100.5162 },
  ]);
  const [riskResult, setRiskResult] = useState(null);
  const [error, setError] = useState('');
  const locationWatcherRef = useRef(null);

  const stopTracking = () => {
    if (locationWatcherRef.current) {
      locationWatcherRef.current.remove();
      locationWatcherRef.current = null;
    }
  };

  useEffect(() => () => stopTracking(), []);

  const makeRoutePoints = (origin, destinationPoint = null) => {
    const lat = Number(origin.latitude);
    const lng = Number(origin.longitude);
    const fallbackDest = destinationPoint || { latitude: lat + 0.0048, longitude: lng + 0.0089 };
    return [
      { latitude: lat, longitude: lng },
      { latitude: lat + 0.0022, longitude: lng + 0.0048 },
      { latitude: lat + 0.0048, longitude: lng + 0.0067 },
      { latitude: fallbackDest.latitude, longitude: fallbackDest.longitude },
    ];
  };

  const localHospitalFallback = (query) => {
    const q = String(query || '').trim().toLowerCase();
    const list = [
      { name: 'โรงพยาบาลศูนย์กลาง', type: 'โรงพยาบาล', address: '123 ถนนตัวอย่าง แขวงพญาไท', province: 'กรุงเทพมหานคร', district: 'พญาไท', latitude: 13.7500, longitude: 100.5650, phone: '02-XXX-XXXX', source: 'SAMPLE' },
      { name: 'คลินิกตัวอย่าง', type: 'คลินิก', address: '456 ซอยตัวอย่าง เขตราชเทวี', province: 'กรุงเทพมหานคร', district: 'ราชเทวี', latitude: 13.7468, longitude: 100.5678, phone: '02-YYY-YYYY', source: 'SAMPLE' },
    ];

    if (!q) return [];
    return list.filter((item) => item.name.toLowerCase().includes(q) || item.address.toLowerCase().includes(q) || item.district.toLowerCase().includes(q));
  };

  const assessCurrentLocation = async () => {
    setLoading(true);
    setError('');
    try {
      const providerStatus = await Location.getProviderStatusAsync();
      if (!providerStatus.locationServicesEnabled) {
        setError('กรุณาเปิด GPS/Location Services ของ Android ก่อนประเมินตำแหน่ง');
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('กรุณาอนุญาตสิทธิ์ Location เพื่อประเมินตำแหน่งปัจจุบัน');
        return;
      }

      let coords = null;
      try {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          mayShowUserSettingsDialog: true,
        });
        coords = current.coords;
      } catch {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown?.coords) {
          coords = lastKnown.coords;
          setError('ใช้ตำแหน่งล่าสุดที่อุปกรณ์เคยเก็บไว้เนื่องจาก GPS ใช้เวลานาน');
        } else {
          throw new Error('gps unavailable');
        }
      }

      if (!coords || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
        setError('ไม่พบพิกัด GPS ที่ถูกต้อง');
        return;
      }

      const origin = { latitude: coords.latitude, longitude: coords.longitude };
      const safeAccuracy = Number.isFinite(coords.accuracy) ? coords.accuracy : null;

      setLocation(coords);
      setLocationAccuracy(safeAccuracy);
      const startPoints = makeRoutePoints(origin, selectedDestination || null);
      setRoutePoints(startPoints);

      if (selectedDestination) {
        const routeFromCurrent = makeRoutePoints(origin, { latitude: selectedDestination.latitude, longitude: selectedDestination.longitude });
        setRoutePoints(routeFromCurrent);
      }

      const risk = evaluateRouteRisk({
        origin,
        destination: selectedDestination || null,
        routePoints: selectedDestination ? makeRoutePoints(origin, selectedDestination) : startPoints,
      });
      setRiskResult(risk);

      stopTracking();
      locationWatcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 5,
        },
        (watchPosition) => {
          const nextCoords = watchPosition.coords;
          if (!nextCoords) return;

          const nextLocation = {
            latitude: nextCoords.latitude,
            longitude: nextCoords.longitude,
            accuracy: nextCoords.accuracy,
            altitude: nextCoords.altitude,
            altitudeAccuracy: nextCoords.altitudeAccuracy,
            heading: nextCoords.heading,
            speed: nextCoords.speed,
          };
          setLocation(nextLocation);
          setLocationAccuracy(Number.isFinite(nextCoords.accuracy) ? nextCoords.accuracy : null);

          if (selectedDestination) {
            setRoutePoints(makeRoutePoints({ latitude: nextCoords.latitude, longitude: nextCoords.longitude }, selectedDestination));
          } else {
            setRoutePoints(makeRoutePoints({ latitude: nextCoords.latitude, longitude: nextCoords.longitude }));
          }
        }
      );

      onHistory?.({
        action_type: 'safe_route',
        title: 'ใช้งาน SafeRoute',
        description: 'ประเมินตำแหน่งปัจจุบัน',
        metadata: { accuracy: safeAccuracy || 'balanced' },
      });
    } catch {
      setError('ไม่สามารถอ่านตำแหน่งปัจจุบันได้ กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  const searchDestination = async () => {
    const query = destination.trim();
    setError('');
    setSearchResults([]);

    if (!query) {
      setError('กรุณากรอกชื่อหรือที่อยู่ปลายทางก่อนค้นหา');
      return;
    }

    setSearchLoading(true);
    try {
      const result = await searchHospitals(query);
      if (!result.error && result.data?.length) {
        const first = result.data[0];
        const safeDestination = {
          name: first.name || first.hospital_name || first.title || query,
          address: first.address || first.location || '',
          latitude: Number(first.latitude || first.lat || 13.7500),
          longitude: Number(first.longitude || first.lng || 100.5650),
          source: first.source || 'supabase',
        };

        setSearchResults(result.data.slice(0, 5));
        setSelectedDestination(safeDestination);

        const baseOrigin = location
          ? { latitude: location.latitude, longitude: location.longitude }
          : { latitude: 13.7563, longitude: 100.5018 };

        const routeFromSearch = makeRoutePoints(baseOrigin, safeDestination);
        setRoutePoints(routeFromSearch);
        setRiskResult(evaluateRouteRisk({ origin: baseOrigin, destination: safeDestination, routePoints: routeFromSearch }));

        return;
      }

      const fallback = localHospitalFallback(query);
      if (fallback.length) {
        const firstFallback = fallback[0];
        const chosen = {
          name: firstFallback.name,
          address: firstFallback.address,
          latitude: Number(firstFallback.latitude),
          longitude: Number(firstFallback.longitude),
          source: 'local-fallback',
        };
        setSelectedDestination(chosen);
        setSearchResults(fallback);

        const baseOrigin = location
          ? { latitude: location.latitude, longitude: location.longitude }
          : { latitude: 13.7563, longitude: 100.5018 };

        const routeFromFallback = makeRoutePoints(baseOrigin, chosen);
        setRoutePoints(routeFromFallback);
        setRiskResult(evaluateRouteRisk({ origin: baseOrigin, destination: chosen, routePoints: routeFromFallback }));
      } else {
        setError('ไม่พบสถานที่ปลายทางที่ตรงกับคำค้นหา');
      }
    } catch {
      const fallback = localHospitalFallback(query);
      if (fallback.length) {
        const firstFallback = fallback[0];
        const fallbackDestination = {
          name: firstFallback.name,
          address: firstFallback.address,
          latitude: Number(firstFallback.latitude),
          longitude: Number(firstFallback.longitude),
          source: 'local-fallback',
        };
        setSelectedDestination(fallbackDestination);
        setSearchResults(fallback);

        const baseOrigin = location
          ? { latitude: location.latitude, longitude: location.longitude }
          : { latitude: 13.7563, longitude: 100.5018 };

        const fallbackRoute = makeRoutePoints(baseOrigin, fallbackDestination);
        setRoutePoints(fallbackRoute);
        setRiskResult(evaluateRouteRisk({ origin: baseOrigin, destination: fallbackDestination, routePoints: fallbackRoute }));
      } else {
        setError('ไม่สามารถค้นหาสถานที่ปลายทางได้ กรุณาลองใหม่');
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const mapRegion = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }
    : {
        latitude: 13.7563,
        longitude: 100.5018,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      };

  return (
    <SafeAreaView style={styles.screen}>
      <Header title="เส้นทางปลอดภัยด้วย AI" go={go} />

      <View style={styles.locationPanel}>
        <Ionicons name="navigate-circle-outline" size={76} color={BLUE} />
        <Text style={styles.bold}>ประเมินตำแหน่งปัจจุบัน</Text>
        <Text style={[styles.muted, { textAlign: 'center', marginTop: 6 }]}>ค้นหาจุดหมายและประเมินตำแหน่ง GPS จริงแบบ fallback route renderer ภายในแอป</Text>
      </View>

      <View style={styles.routeMapWrap}>
        <MapView style={styles.map} initialRegion={mapRegion} region={mapRegion}>
          {location && (
            <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }}>
              <View style={styles.markerDot} />
            </Marker>
          )}
          {selectedDestination && (
            <Marker coordinate={{ latitude: selectedDestination.latitude, longitude: selectedDestination.longitude }}>
              <View style={styles.markerDestination} />
            </Marker>
          )}
          <Polyline coordinates={routePoints} strokeColor={BLUE} strokeWidth={4} lineDashPattern={[1]} />
        </MapView>
      </View>

      <View style={styles.routeCard}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.routeSearchInput}
            value={destination}
            onChangeText={setDestination}
            placeholder="ค้นหาสถานที่ปลายทาง เช่น โรงพยาบาล หรือ พญาไท"
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="text"
            returnKeyType="search"
            onSubmitEditing={searchDestination}
          />
          <Pressable onPress={searchDestination} style={styles.routeSearchButton} disabled={searchLoading}>
            <Ionicons name="search" size={18} color="#fff" />
          </Pressable>
        </View>

        {searchResults.length > 0 ? (
          <View style={styles.searchResults}>
            {searchResults.slice(0, 3).map((item, index) => (
              <Pressable key={`${item.name || item.hospital_name || item.title || 'result'}-${index}`} style={styles.searchResultItem} onPress={() => {
                const selected = item.name ? item : {
                  name: item.hospital_name || item.title || 'สถานที่ที่เลือก',
                  address: item.address || '',
                  latitude: Number(item.latitude || item.lat || 13.7500),
                  longitude: Number(item.longitude || item.lng || 100.5650),
                  source: item.source || 'local',
                };
                setSelectedDestination(selected);
                if (location) {
                  setRoutePoints(makeRoutePoints({ latitude: location.latitude, longitude: location.longitude }, selected));
                }
              }}>
                <Text style={styles.cardTitle}>{item.name || item.hospital_name || item.title || 'สถานที่'}</Text>
                <Text style={styles.muted}>{item.address || item.district || '—'}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {location ? (
          <Text style={styles.muted}>ตำแหน่งปัจจุบัน: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} | accuracy: {locationAccuracy != null ? `${Math.round(locationAccuracy)} m` : 'ไม่ระบุ'}</Text>
        ) : null}
        {selectedDestination ? (
          <Text style={styles.muted}>ปลายทาง: {selectedDestination.name || selectedDestination.title || 'สถานที่'} ({selectedDestination.latitude.toFixed(4)}, {selectedDestination.longitude.toFixed(4)})</Text>
        ) : null}

        {riskResult ? (
          <View style={styles.riskReport}>
            <View style={styles.scoreRow}>
              <Text style={styles.cardTitle}>Risk Score</Text>
              <View style={styles.score}><Text style={styles.scoreNum}>{riskResult.score}</Text><Text style={styles.score100}>/100</Text></View>
            </View>
            <Text style={[styles.risk, { color: riskResult.score >= 75 ? RED : riskResult.score >= 45 ? '#C19B14' : GREEN }]}>{riskResult.label}</Text>
            <Text style={styles.muted}>{riskResult.distanceKm} กม. • {riskResult.summary}</Text>
          </View>
        ) : null}

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
          ...(profile?.role === 'admin' ? [['Admin Dashboard', 'admin', 'speedometer-outline']] : []),
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
    {fields.map(([key, label]) => <View key={key}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={values[key] == null ? '' : String(values[key])} onChangeText={(text) => setValue(key, text)} keyboardType={['height', 'weight'].includes(key) ? 'numeric' : 'default'} autoCapitalize={['full_name', 'gender', 'blood_type'].includes(key) ? 'words' : 'none'} autoCorrect={false} inputMode={['height', 'weight'].includes(key) ? 'numeric' : 'text'} /></View>)}
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

function AdminDashboard({ go, profile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const result = await getAdminDashboard();
    if (result.error) setError(result.error.message || 'โหลดข้อมูล Admin ไม่สำเร็จ');
    else setData(result.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (profile?.role !== 'admin') {
    return <SafeAreaView style={styles.screen}><Header title="Admin" go={go} /><View style={styles.content}><Text style={styles.errorBox}>บัญชีนี้ไม่มีสิทธิ์ Admin</Text><Button title="กลับหน้าหลัก" onPress={() => go('home')} /></View></SafeAreaView>;
  }

  const stats = data || {};
  const cards = [
    ['ผู้ใช้งานทั้งหมด', stats.total_users, 'people-outline'],
    ['ยืนยันอีเมลแล้ว', stats.confirmed_users, 'checkmark-circle-outline'],
    ['ผู้ใช้ใหม่ 7 วัน', stats.new_users_7d, 'person-add-outline'],
    ['Active 7 วัน', stats.active_users_7d, 'pulse-outline'],
    ['กิจกรรมทั้งหมด', stats.total_activities, 'analytics-outline'],
    ['ข้อมูลยา', stats.total_drug_records, 'medkit-outline'],
    ['โรงพยาบาล', stats.total_hospitals, 'business-outline'],
  ];

  return <SafeAreaView style={styles.screen}>
    <Header title="Admin Dashboard" go={go} />
    <ScrollView contentContainerStyle={styles.adminContent} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      {loading && !data ? <ActivityIndicator size="large" color={BLUE} /> : null}
      {error ? <Text style={styles.errorBox}>{error}</Text> : null}
      {!loading && !error ? <>
        <Text style={styles.adminNote}>ข้อมูลจริงจาก Supabase</Text>
        <View style={styles.adminGrid}>{cards.map(([label, value, icon]) => <View key={label} style={styles.adminStat}><Ionicons name={icon} size={22} color={BLUE} /><Text style={styles.adminValue}>{Number(value || 0).toLocaleString('th-TH')}</Text><Text style={styles.muted}>{label}</Text></View>)}</View>
        <View style={styles.infoBlock}><Text style={styles.cardTitle}>กิจกรรม 7 วันล่าสุด</Text>{(stats.usage_by_day || []).map((item) => <View key={String(item.date)} style={styles.adminDay}><Text style={styles.muted}>{String(item.date)}</Text><Text style={styles.bold}>{Number(item.count || 0).toLocaleString('th-TH')} รายการ</Text></View>)}</View>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
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
  const pendingRecoveryRef = useRef(false);

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
    const loadedProfile = await loadUserData(currentUser);
    setScreen(loadedProfile?.role === 'admin' ? 'admin' : 'home');
    return { data: response.data };
  };

  const handleRegister = async ({
    fullName,
    email,
    password,
    confirmPassword,
    dateOfBirth,
    gender,
    height,
    weight,
    bloodType,
  }) => {
    const response = await registerUser({
      fullName,
      email,
      password,
      confirmPassword,
      dateOfBirth,
      gender,
      height,
      weight,
      bloodType,
    });

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
    const loadedProfile = await loadUserData(currentUser);
    setScreen(loadedProfile?.role === 'admin' ? 'admin' : 'home');
    return { data: response.data };
  };

  const handleForgotPassword = async (email) => {
    return requestPasswordReset(email);
  };

  const handleUpdatePassword = async (password) => {
    const response = await updatePassword(password);
    if (response.error) return response;

    // Password recovery sessions are short-lived and should not leave the
    // user stuck on the reset screen after a successful update.
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setHistory([]);
    setSavedItems([]);
    setSettings(null);
    return response;
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

    const parseAuthUrl = (url) => {
      const result = { code: null, type: null, accessToken: null, refreshToken: null };
      if (!url) return result;

      const queryIndex = url.indexOf('?');
      const hashIndex = url.indexOf('#');
      const queryPart =
        queryIndex >= 0
          ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
          : '';
      const hashPart = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';

      const parseParams = (value) => {
        const params = {};
        value.split('&').forEach((pair) => {
          if (!pair) return;
          const [rawKey, ...rawValue] = pair.split('=');
          const key = decodeURIComponent(rawKey || '');
          const val = decodeURIComponent(rawValue.join('=') || '');
          if (key) params[key] = val;
        });
        return params;
      };

      const query = parseParams(queryPart);
      const hash = parseParams(hashPart);

      result.code = query.code || hash.code || null;
      result.type = query.type || hash.type || null;
      result.accessToken = hash.access_token || query.access_token || null;
      result.refreshToken = hash.refresh_token || query.refresh_token || null;
      return result;
    };

    const handleAuthUrl = async (url) => {
      const auth = parseAuthUrl(url);
      if (!auth.code && !auth.accessToken) return;

      const isRecovery = auth.type === 'recovery';
      if (isRecovery) pendingRecoveryRef.current = true;

      let error = null;

      if (auth.code) {
        const result = await supabase.auth.exchangeCodeForSession(auth.code);
        error = result.error;
      } else if (auth.accessToken && auth.refreshToken) {
        const result = await supabase.auth.setSession({
          access_token: auth.accessToken,
          refresh_token: auth.refreshToken,
        });
        error = result.error;
      }

      if (!mounted) return;

      if (error) {
        pendingRecoveryRef.current = false;
        Alert.alert(
          isRecovery ? 'ลิงก์เปลี่ยนรหัสผ่านหมดอายุ' : 'ยืนยันอีเมลไม่สำเร็จ',
          'กรุณาขอลิงก์ใหม่แล้วลองอีกครั้ง'
        );
        setScreen('login');
        return;
      }

      if (isRecovery) {
        setScreen('resetPassword');
      }
    };

    const initializeSession = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) await handleAuthUrl(initialUrl);
      if (!mounted) return;

      const { data } = await getCurrentUser();
      if (!mounted) return;

      if (data) {
        setUser(data);
        const loadedProfile = await loadUserData(data);
        if (!pendingRecoveryRef.current) setScreen(loadedProfile?.role === 'admin' ? 'admin' : 'home');
      } else {
        setScreen('login');
      }

      setAuthLoading(false);
    };

    initializeSession();

    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      handleAuthUrl(url);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY' || pendingRecoveryRef.current) {
        if (session?.user) {
          setUser(session.user);
          await loadUserData(session.user);
        }
        setScreen('resetPassword');
        return;
      }

      if (session?.user) {
        setUser(session.user);
        const loadedProfile = await loadUserData(session.user);
        setScreen(loadedProfile?.role === 'admin' ? 'admin' : 'home');
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
      linkingSubscription.remove();
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
    login: <Login go={go} onSubmit={handleLogin} onForgot={() => go('forgotPassword')} />,
    register: <Register go={go} onSubmit={handleRegister} />,
    forgotPassword: <ForgotPassword go={go} onSubmit={handleForgotPassword} />,
    resetPassword: <ResetPassword go={go} onSubmit={handleUpdatePassword} />,
    home: <Home go={go} user={user} profile={profile} onSearch={searchFromHome} />,
    admin: <AdminDashboard go={go} profile={profile} />,
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
  authBackRow: { width: '100%', marginBottom: 12 },
  backButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, alignSelf: 'flex-start' },
  backText: { color: DARK, fontSize: 15, fontWeight: '600', marginLeft: 6 },
  successBox: { width: '100%', backgroundColor: '#E9F8F1', borderWidth: 1, borderColor: '#A9E3C8', color: '#147A4C', padding: 12, borderRadius: 10, marginTop: 14, lineHeight: 21 },
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
  chatScroll: { flex: 1 },
  chat: { padding: 16, paddingBottom: 24, flexGrow: 1 },
  bubble: { maxWidth: '82%', padding: 12, borderRadius: 15, marginBottom: 10 },
  ai: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER },
  me: { alignSelf: 'flex-end', backgroundColor: BLUE },
  text: { color: DARK, fontSize: 13, lineHeight: 19 },
  meText: { color: '#fff', fontSize: 13, lineHeight: 19 },
  composer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5ECF6', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 68, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerInput: { flex: 1, minHeight: 42, maxHeight: 90, borderWidth: 1, borderColor: BORDER, borderRadius: 21, backgroundColor: '#F8FBFF', paddingHorizontal: 16, paddingVertical: 10, color: DARK, fontSize: 14 },
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
  routeMapWrap: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: '#eef4ff', borderWidth: 1, borderColor: BORDER },
  map: { width: '100%', height: 230 },
  markerDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: RED, borderWidth: 2, borderColor: '#fff' },
  markerDestination: { width: 16, height: 16, borderRadius: 8, backgroundColor: GREEN, borderWidth: 2, borderColor: '#fff' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  routeSearchInput: { flex: 1, height: 45, borderWidth: 1, borderColor: BORDER, borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 14, color: DARK },
  routeSearchButton: { width: 45, height: 45, borderRadius: 10, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  searchResults: { backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 8, marginBottom: 12 },
  searchResultItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  score: { flexDirection: 'row', alignItems: 'baseline' },
  scoreNum: { fontSize: 34, fontWeight: '900', color: GREEN },
  score100: { fontSize: 15, color: '#7D90AA' },
  risk: { color: GREEN, fontWeight: '800', marginVertical: 5 },
  riskReport: { backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, marginTop: 12 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  score: { flexDirection: 'row', alignItems: 'baseline' },
  scoreNum: { fontSize: 34, fontWeight: '900', color: GREEN },
  score100: { fontSize: 14, color: '#7D90AA', marginLeft: 4 },
  profile: { alignItems: 'center', paddingVertical: 15 },
  profileAvatar: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#DCE9FF', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  profileAvatarText: { fontSize: 28, color: BLUE, fontWeight: '800' },
  menu: { height: 57, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EDF1F7', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15 },
  empty: { color: '#7186A3', textAlign: 'center', paddingVertical: 35 },
  settingRow: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 13, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adminContent: { padding: 16, paddingBottom: 40 },
  adminNote: { color: '#526B8D', fontWeight: '700', marginBottom: 12 },
  adminGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  adminStat: { width: '48%', minHeight: 108, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4ECF7', borderRadius: 14, padding: 13 },
  adminValue: { fontSize: 22, fontWeight: '900', color: DARK, marginTop: 8 },
  adminDay: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#EDF1F7' },
});
