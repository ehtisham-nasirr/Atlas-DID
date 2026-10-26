import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { messagePreview } from '@/components/message-banner';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useChat } from '@/context/chat';
import { findUserByPhone, useDirectory } from '@/data/directory';
import { ROLE_LABEL, type User } from '@/data/mock';
import { type ConversationSummary } from '@/lib/chat-api';
import { formatDateTime } from '@/lib/format';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const openChat = (partner: string) => router.push({ pathname: '/chat/[partner]', params: { partner } });

/**
 * Connect cards for the people in the user's network, plus chats started by others.
 * Mechanics: retailer and distributor. Retailers: distributor and RM. Distributors: RM and their
 * retailers. RM: the distributors and retailers of their region.
 * Used by the app's Chat screen and the RM web portal.
 */
export function ChatOverview({ bottomPadding }: { bottomPadding: number }) {
  const { user } = useAuth();
  const { conversations, offline, isUnread } = useChat();
  const directory = useDirectory();

  if (!user) return null;

  const linked = (phone?: string) => (phone ? findUserByPhone(phone) : undefined);
  const card = (icon: IconName, title: string) => (partner?: User) =>
    partner ? [{ icon, title, partner }] : [];
  const retailerCard = card('storefront', 'Connect to Retailer');
  const distributorCard = card('local-shipping', 'Connect to Distributor');
  const rmCard = card('support-agent', 'Connect to Regional Manager');
  const contacts =
    user.role === 'mechanic'
      ? [...retailerCard(linked(user.retailerPhone)), ...distributorCard(linked(user.distributorPhone))]
      : user.role === 'retailer'
        ? [...distributorCard(linked(user.distributorPhone)), ...rmCard(linked(user.rmPhone))]
        : user.role === 'distributor'
          ? [
              ...rmCard(linked(user.rmPhone)),
              ...directory
                .filter((u) => u.role === 'retailer' && u.distributorPhone === user.phone)
                .flatMap((u) => retailerCard(u)),
            ]
          : directory
              .filter((u) => u.rmPhone === user.phone && (u.role === 'distributor' || u.role === 'retailer'))
              .sort((a, b) => a.role.localeCompare(b.role))
              .flatMap((u) => (u.role === 'distributor' ? distributorCard(u) : retailerCard(u)));
  const pinned = contacts.map((c) => c.partner.phone);
  const summaryWith = (partner?: string) => conversations?.find((c) => c.partner === partner);
  // Chats started by others, e.g. mechanics writing to their retailer.
  const incoming = (conversations ?? []).filter((c) => !pinned.includes(c.partner));
  const showInbox = user.role !== 'mechanic' || incoming.length > 0;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}>
        {offline && (
          <Text style={styles.offline}>Can&apos;t reach the chat server. Retrying...</Text>
        )}

        {contacts.length > 0 && <Text style={styles.subtitle}>Who do you want to talk to?</Text>}
        {contacts.map((c) => (
          <ConnectCard
            key={c.partner.phone}
            icon={c.icon}
            title={c.title}
            partner={c.partner}
            summary={summaryWith(c.partner.phone)}
            me={user.phone}
            isUnread={isUnread}
          />
        ))}

        {showInbox && (
          <>
            <Text style={[styles.subtitle, styles.inboxTitle]}>
              {user.role === 'retailer' || user.role === 'distributor'
                ? 'Messages from mechanics'
                : 'Messages'}
            </Text>
            {incoming.length === 0 && conversations !== null && (
              <Text style={styles.empty}>No messages yet.</Text>
            )}
            {incoming.map((c) => (
              <InboxRow key={c.conversation} summary={c} me={user.phone} unread={isUnread(c)} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ConnectCard({
  icon,
  title,
  partner,
  summary,
  me,
  isUnread,
}: {
  icon: IconName;
  title: string;
  partner?: User;
  summary?: ConversationSummary;
  me: string;
  isUnread: (summary: ConversationSummary) => boolean;
}) {
  const unread = summary ? isUnread(summary) : false;
  return (
    <Pressable
      disabled={!partner}
      onPress={() => partner && openChat(partner.phone)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardIcon}>
        <MaterialIcons name={icon} size={28} color={Colors.barLogout} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {partner ? partner.shopName : 'Not assigned yet'}
        </Text>
        {summary && (
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {summary.last.from === me ? 'You: ' : ''}
            {messagePreview(summary.last)}
          </Text>
        )}
      </View>
      {unread ? <View style={styles.unreadDot} /> : null}
      <MaterialIcons name="chevron-right" size={26} color={Colors.textMuted} />
    </Pressable>
  );
}

function InboxRow({
  summary,
  me,
  unread,
}: {
  summary: ConversationSummary;
  me: string;
  unread: boolean;
}) {
  const partner = findUserByPhone(summary.partner);
  const name = partner?.name ?? summary.partner;
  return (
    <Pressable
      onPress={() => openChat(summary.partner)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <Avatar name={name} photoUrl={partner?.photoUrl} size={48} />
      <View style={styles.cardBody}>
        <View style={styles.inboxTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.time}>{formatDateTime(summary.last.at)}</Text>
        </View>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {partner ? `${ROLE_LABEL[partner.role]} • ${partner.shopName}` : 'Unknown user'}
        </Text>
        <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
          {summary.last.from === me ? 'You: ' : ''}
          {messagePreview(summary.last)}
        </Text>
      </View>
      {unread ? <View style={styles.unreadDot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingTop: 16,
    paddingHorizontal: PagePadding + 0.5,
  },
  inboxTitle: {
    marginTop: 12,
  },
  subtitle: {
    marginTop: 2,
    marginBottom: 14,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textMuted,
  },
  offline: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.error,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  cardPressed: {
    backgroundColor: Colors.scanButton,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
  cardBody: {
    flex: 1,
  },
  inboxTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    flexShrink: 1,
    fontFamily: Fonts.medium,
    fontSize: 15.5,
    color: Colors.text,
  },
  time: {
    marginLeft: 'auto',
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textMuted,
  },
  cardMeta: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.surfaceLabel,
  },
  preview: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textMuted,
  },
  previewUnread: {
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.barItemActive,
  },
  empty: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
  },
});
