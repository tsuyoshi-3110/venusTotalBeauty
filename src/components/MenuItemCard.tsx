import {
  SwipeableList,
  SwipeableListItem,
  TrailingActions,
  SwipeAction,
} from "react-swipeable-list";
import "react-swipeable-list/dist/styles.css";

export default function MenuItemCard({
  item,
  onDelete,
  isLoggedIn,
}: {
  item: any;
  onDelete: () => void;
  isLoggedIn: boolean;
}) {
  const trailingActions = () => (
    <TrailingActions>
      <SwipeAction onClick={onDelete}>
        <div className="bg-red-500 text-white px-4 py-2 flex items-center justify-center whitespace-nowrap w-24 rounded-r">
          削除
        </div>
      </SwipeAction>
    </TrailingActions>
  );

  return (
    <SwipeableList threshold={0.25}>
      <SwipeableListItem trailingActions={isLoggedIn && trailingActions()}>
        <div className="flex justify-between items-center py-3 border-b px-2 rounded">
          <div>
            <p className="font-medium">
              {item.name}：¥{item.price.toLocaleString()}
              {typeof item.isTaxIncluded === "boolean" &&
                `（${item.isTaxIncluded ? "税込" : "税別"}）`}
            </p>
            {item.description && (
              <p className="text-sm text-gray-500">{item.description}</p>
            )}
          </div>
        </div>
      </SwipeableListItem>
    </SwipeableList>
  );
}
