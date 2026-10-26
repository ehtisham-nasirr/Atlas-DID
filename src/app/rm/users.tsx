import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AddUserModal } from '@/components/add-user';
import { Avatar } from '@/components/avatar';
import { ScreenTitle } from '@/components/app-header';
import { useRmWide } from '@/components/rm-nav';
import { SegmentTabs } from '@/components/segment-tabs';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { findUserByPhone, useDirectory } from '@/data/directory';
import { ROLE_LABEL, type User } from '@/data/mock';

type Filter = 'all' | 'mechanic' | 'retailer' | 'distributor';

/** The RM's users: everyone registered in their region, and the button to add more. */
export default function RmUsersScreen() {
  const wide = useRmWide();
  const { user } = useAuth();
  const directory = useDirectory();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  if (!user) return null;
  const region = directory.filter((u) => u.rmPhone === user.phone && u.role !== 'rm');
  const count = (role: Filter) => (role === 'all' ? region.length : region.filter((u) => u.role === role).length);
  // Phones have no room for the counts.
  const tab = (role: Filter, label: string) => (wide ? `${label} (${count(role)})` : label);
  const q = query.trim().toLowerCase();
  const visible = region
    .filter((u) => filter === 'all' || u.role === filter)
    .filter(
      (u) =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.phone.includes(q) ||
        u.shopName.toLowerCase().includes(q) ||
        u.city.toLowerCase().includes(q)
    );

  return (
    <View style={styles.screen}>
      <FlatList
        data={visible}
        keyExtractor={(u) => u.phone}
        numColumns={wide ? 2 : 1}
        key={wide ? 'wide' : 'narrow'}
        columnWrapperStyle={wide ? styles.row : undefined}
        contentContainerStyle={[styles.content, wide && styles.contentWide]}
        ListHeaderComponent={
          <>
            <View style={styles.titleRow}>
              <ScreenTitle>Users</ScreenTitle>
              <Pressable
                onPress={() => setAdding(true)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.add, pressed && styles.addPressed]}>
                <MaterialIcons name="person-add" size={20} color={Colors.barLogout} />
                <Text style={styles.addText}>Add User</Text>
              </Pressable>
            </View>
            <SegmentTabs<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: tab('all', 'All') },
                { value: 'mechanic', label: tab('mechanic', 'Mechanics') },
                { value: 'retailer', label: tab('retailer', 'Retailers') },
                { value: 'distributor', label: tab('distributor', 'Distributors') },
              ]}
            />
            <View style={styles.search}>
              <MaterialIcons name="search" size={22} color={Colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search name, phone, shop or city"
                placeholderTextColor={Colors.textMuted}
                style={styles.searchInput}
                cursorColor={Colors.text}
                selectionColor={Colors.bar}
              />
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="group-add" size={44} color={Colors.surfaceDivider} />
            <Text style={styles.emptyText}>
              {region.length === 0
                ? 'No users yet. Tap "Add User" to register a distributor, retailer or mechanic.'
                : 'No users match your search.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => <UserCard person={item} wide={wide} />}
      />
      <AddUserModal visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

function UserCard({ person, wide }: { person: User; wide: boolean }) {
  const link = (label: string, phone?: string) => {
    const other = phone ? findUserByPhone(phone) : undefined;
    return other ? `${label}: ${other.name}` : null;
  };
  const links = [link('Retailer', person.retailerPhone), link('Distributor', person.distributorPhone)]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={[styles.card, wide && styles.cardWide]}>
      <Avatar name={person.name} photoUrl={person.photoUrl} size={44} />
      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {person.name}
          </Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{ROLE_LABEL[person.role]}</Text>
          </View>
        </View>
        <Text style={styles.meta}>{person.phone}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[person.shopName, person.city].filter(Boolean).join(' • ')}
        </Text>
        {links ? <Text style={styles.links}>{links}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: PagePadding + 0.5,
    paddingTop: 12,
    paddingBottom: 32,
  },
  contentWide: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  row: {
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.bar,
  },
  addPressed: {
    backgroundColor: Colors.barIndicator,
  },
  addText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.barLogout,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    marginBottom: 14,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: Colors.surface,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.text,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.background,
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.08)',
  },
  cardWide: {
    flex: 1,
  },
  cardBody: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flexShrink: 1,
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.text,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: Colors.surface,
  },
  roleText: {
    fontFamily: Fonts.medium,
    fontSize: 11.5,
    color: Colors.barItemActive,
  },
  meta: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  links: {
    marginTop: 4,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    color: Colors.barItemActive,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
  },
});
